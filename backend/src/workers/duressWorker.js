const { Queue, Worker, JobScheduler } = require('bullmq');
const { randomUUID } = require('crypto');
const prisma = require('../config/database');
const redis = require('../config/redis');
const emergencyService = require('../services/emergencyService');
const vaultService = require('../services/vaultService');
const systemLogService = require('../services/systemLogService');

const queueName = 'duress';

const duressQueue = new Queue(queueName, { connection: redis });
new JobScheduler(queueName, { connection: redis });

async function acquireLock(lockKey, ttl = 240000) {
  const result = await redis.set(lockKey, 'locked', 'NX', 'PX', ttl);
  return result === 'OK';
}

async function releaseLock(lockKey) {
  try {
    await redis.del(lockKey);
  } catch (error) {
    // ignore release errors
  }
}

async function monitorCheckinsJob() {
  const now = new Date();

  const users = await prisma.user.findMany({
    where: {
      next_checkin_deadline: { lt: now },
      victimIncidents: { none: { status: 'ACTIVE' } },
    },
  });

  for (const user of users) {
    const lockKey = `deadman:lock:${user.id}`;
    const locked = await acquireLock(lockKey);
    if (!locked) {
      continue;
    }

    try {
      if (user.deadmanStage >= 1) {
        continue;
      }

      await emergencyService.notifyGuardians(user, 1);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          deadmanStage: 1,
          deadmanEscalationTriggeredAt: new Date(),
        },
      });

      await duressQueue.add(
        'escalate-user',
        { userId: user.id },
        {
          delay: 5 * 60 * 1000,
          jobId: `deadman-escalate-${user.id}`,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      await systemLogService.createLog({
        actionType: 'DEADMAN_LEVEL_1_SENT',
        description: `Level 1 dead man alert queued for user ${user.id}`,
      });
    } catch (error) {
      await systemLogService.createLog({
        actionType: 'DEADMAN_MONITOR_ERROR',
        description: `Failed to process dead man check for user ${user.id}: ${error.message}`,
      });
    } finally {
      await releaseLock(lockKey);
    }
  }
}

async function escalateUserJob(data) {
  const { userId } = data;
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    await systemLogService.createLog({
      actionType: 'DEADMAN_ESCALATION_MISSING_USER',
      description: `Escalation job skipped because user ${userId} was not found`,
    });
    return;
  }

  if (user.deadmanStage !== 1) {
    return;
  }

  if (user.next_checkin_deadline && user.next_checkin_deadline > new Date()) {
    return;
  }

  const activeIncident = await prisma.rescueIncident.findFirst({
    where: {
      victimId: userId,
      status: 'ACTIVE',
    },
  });

  if (activeIncident) {
    await systemLogService.createLog({
      actionType: 'DEADMAN_ESCALATION_ABORTED',
      description: `Escalation aborted for user ${userId} because an active incident already exists`,
    });
    return;
  }

  await emergencyService.notifyGuardians(user, 2);
  await prisma.user.update({
    where: { id: userId },
    data: {
      deadmanStage: 2,
      deadmanEscalationTriggeredAt: new Date(),
    },
  });

  await systemLogService.createLog({
    actionType: 'DEADMAN_LEVEL_2_SENT',
    description: `Level 2 dead man alert sent for user ${userId}`,
  });
}

async function autoWipeJob() {
  const now = new Date();
  const users = await prisma.user.findMany({
    where: {
      isAutoWipeEnabled: true,
      autoWipeDays: { not: null },
    },
    include: { vault: true },
  });

  for (const user of users) {
    if (!user.next_checkin_deadline || !user.auto_wipe_days) {
      continue;
    }

    const threshold = new Date(now.getTime() - user.auto_wipe_days * 24 * 60 * 60 * 1000);
    if (user.next_checkin_deadline > threshold) {
      continue;
    }

    if (!user.vault) {
      await systemLogService.createLog({
        actionType: 'AUTO_WIPE_SKIPPED',
        description: `No vault found for user ${user.id}, skipping auto-wipe`,
      });
      continue;
    }

    await vaultService.shredVaultForUser(user.id);
    await systemLogService.createLog({
      actionType: 'AUTO_WIPE_EXECUTED',
      description: `User ${user.id} vault data shredded after ${user.autoWipeDays} days overdue`,
    });
  }
}

function startDuressWorkers() {
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
  console.log('✅ Duress workers started: deadman monitor and auto-wipe');
}

module.exports = { startDuressWorkers };
