const { Queue, Worker, JobScheduler } = require('bullmq');
const redis = require('../config/redis');
const User = require('../models/User');
const RescueIncident = require('../models/RescueIncident');
const SecuritySetting = require('../models/SecuritySetting');
const Vault = require('../models/Vault');
const emergencyService = require('../services/emergencyService');
const vaultService = require('../services/vaultService');
const systemLogService = require('../services/systemLogService');

const queueName = 'duress';

let duressQueue = null;
let jobScheduler = null;

async function acquireLock(lockKey, ttl = 240000) {
  if (!redis) {
    return true;
  }
  try {
    const result = await redis.set(lockKey, 'locked', 'NX', 'PX', ttl);
    return result === 'OK';
  } catch (_err) {
    return true;
  }
}

async function releaseLock(lockKey) {
  if (!redis) {
    return;
  }
  try {
    await redis.del(lockKey);
  } catch (_error) {
    // ignore release errors
  }
}

async function monitorCheckinsJob() {
  const now = new Date();

  const users = await User.find({
    nextDeadline: { $lt: now },
    role: 'user',
  });

  for (const user of users) {
    const activeIncident = await RescueIncident.findOne({
      victimId: user._id,
      status: 'ACTIVE',
    });
    if (activeIncident) {
      continue;
    }

    const lockKey = `deadman:lock:${user._id}`;
    const locked = await acquireLock(lockKey);
    if (!locked) {
      continue;
    }

    try {
      if (Number(user.deadmanStage || 0) >= 1) {
        continue;
      }

      await emergencyService.notifyGuardians(user, 1);
      user.deadmanStage = 1;
      user.deadmanEscalationTriggeredAt = new Date();
      await user.save();

      if (duressQueue) {
        await duressQueue.add(
          'escalate-user',
          { userId: user._id },
          {
            delay: 5 * 60 * 1000,
            jobId: `deadman-escalate-${user._id}`,
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
      }

      await systemLogService.createLog({
        actionType: 'DEADMAN_LEVEL_1_SENT',
        description: `Level 1 dead man alert queued for user ${user._id}`,
      });
    } catch (error) {
      await systemLogService.createLog({
        actionType: 'DEADMAN_MONITOR_ERROR',
        description: `Failed to process dead man check for user ${user._id}: ${error.message}`,
      });
    } finally {
      await releaseLock(lockKey);
    }
  }
}

async function escalateUserJob(data) {
  const { userId } = data;
  const user = await User.findById(userId);

  if (!user) {
    await systemLogService.createLog({
      actionType: 'DEADMAN_ESCALATION_MISSING_USER',
      description: `Escalation job skipped because user ${userId} was not found`,
    });
    return;
  }

  if (Number(user.deadmanStage || 0) !== 1) {
    return;
  }

  if (user.nextDeadline && user.nextDeadline > new Date()) {
    return;
  }

  const activeIncident = await RescueIncident.findOne({
    victimId: userId,
    status: 'ACTIVE',
  });

  if (activeIncident) {
    await systemLogService.createLog({
      actionType: 'DEADMAN_ESCALATION_ABORTED',
      description: `Escalation aborted for user ${userId} because an active incident already exists`,
    });
    return;
  }

  await emergencyService.notifyGuardians(user, 2);
  user.deadmanStage = 2;
  user.deadmanEscalationTriggeredAt = new Date();
  await user.save();

  await systemLogService.createLog({
    actionType: 'DEADMAN_LEVEL_2_SENT',
    description: `Level 2 dead man alert sent for user ${userId}`,
  });
}

async function autoWipeJob() {
  const now = new Date();
  const securitySettings = await SecuritySetting.find({
    autoWipeDays: { $gt: 0 },
  });

  for (const security of securitySettings) {
    const user = await User.findById(security.userId);
    if (!user || !user.lastCheckinTime) {
      continue;
    }

    const threshold = new Date(now.getTime() - Number(security.autoWipeDays) * 24 * 60 * 60 * 1000);
    if (new Date(user.lastCheckinTime) > threshold) {
      continue;
    }

    const vault = await Vault.findOne({ userId: user._id });
    if (!vault) {
      await systemLogService.createLog({
        actionType: 'AUTO_WIPE_SKIPPED',
        description: `No vault found for user ${user._id}, skipping auto-wipe`,
      });
      continue;
    }

    await vaultService.shredVaultForUser(user._id);
    security.lastAutoWipeDueAt = new Date();
    await security.save();
    await systemLogService.createLog({
      actionType: 'AUTO_WIPE_EXECUTED',
      description: `User ${user._id} vault data shredded after ${security.autoWipeDays} days overdue`,
    });
  }
}

function startDuressWorkers() {
  if (!redis) {
    // eslint-disable-next-line no-console
    console.log('[SafeSolo] Duress BullMQ workers skipped (Redis not configured, DeadMan worker active via native timer)');
    return;
  }

  try {
    duressQueue = new Queue(queueName, { connection: redis });
    jobScheduler = new JobScheduler(queueName, { connection: redis });

    const oneMinuteMonitor = {
      repeat: { cron: '*/1 * * * *' },
      jobId: 'deadman-monitor-checkins',
      removeOnComplete: true,
      removeOnFail: false,
    };

    const dailyAutoWipe = {
      repeat: { cron: '0 0 * * *' },
      jobId: 'deadman-auto-wipe',
      removeOnComplete: true,
      removeOnFail: false,
    };

    Promise.all([
      duressQueue.add('monitor-checkins', {}, oneMinuteMonitor),
      duressQueue.add('auto-wipe', {}, dailyAutoWipe),
    ]).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to add repeatable duress jobs:', error.message);
    });

    new Worker(
      queueName,
      async (job) => {
        switch (job.name) {
          case 'monitor-checkins':
            await monitorCheckinsJob();
            break;
          case 'escalate-user':
            await escalateUserJob(job.data);
            break;
          case 'auto-wipe':
            await autoWipeJob();
            break;
          default:
            break;
        }
      },
      {
        connection: redis,
        lockDuration: 300000,
        concurrency: 1,
      },
    );

    // eslint-disable-next-line no-console
    console.log('Duress workers started: deadman monitor and auto-wipe');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to start duress BullMQ workers:', error.message);
  }
}

module.exports = { startDuressWorkers };
