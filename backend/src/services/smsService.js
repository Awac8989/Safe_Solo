const crypto = require('crypto');

const {
  nowIso,
  smsDispatchStatements,
} = require('../config/sqlite');

function buildEmergencyMessage({ user, location }) {
  return [
    `[SOS] SafeSolo canh bao khan cap cho ${user.fullName}.`,
    `So dien thoai: ${user.phoneNumber}.`,
    `Vi tri cuoi: ${location ? `${location.lat}, ${location.lng}` : 'khong co du lieu'}.`,
  ].join(' ');
}

function providerConfig(kind) {
  if (kind === 'fallback') {
    return {
      provider: (process.env.SMS_FALLBACK_PROVIDER || 'none').toLowerCase(),
      webhookUrl: process.env.SMS_FALLBACK_WEBHOOK_URL || '',
      webhookToken: process.env.SMS_FALLBACK_WEBHOOK_TOKEN || '',
    };
  }

  return {
    provider: (process.env.SMS_PRIMARY_PROVIDER || 'mock').toLowerCase(),
    webhookUrl: process.env.SMS_PRIMARY_WEBHOOK_URL || '',
    webhookToken: process.env.SMS_PRIMARY_WEBHOOK_TOKEN || '',
  };
}

function readPolicy() {
  return {
    maxRetries: Math.max(Number(process.env.SMS_MAX_RETRIES || 2), 1),
    retryDelayMs: Math.max(Number(process.env.SMS_RETRY_DELAY_MS || 1200), 0),
    requestTimeoutMs: Math.max(Number(process.env.SMS_REQUEST_TIMEOUT_MS || 7000), 1000),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendByWebhook(config, payload, timeoutMs) {
  if (!config.webhookUrl) {
    throw new Error('Webhook URL is not configured');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.webhookToken ? { Authorization: `Bearer ${config.webhookToken}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    return {
      providerMessageId: `webhook-${Date.now()}`,
      rawResponse: responseText,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function sendWithProvider(config, { to, message }, timeoutMs) {
  if (config.provider === 'none') {
    throw new Error('Provider disabled');
  }

  if (config.provider === 'mock') {
    return {
      providerMessageId: `mock-${Date.now()}-${to}`,
      rawResponse: JSON.stringify({ mocked: true }),
    };
  }

  if (config.provider === 'webhook') {
    return sendByWebhook(
      config,
      {
        to,
        message,
      },
      timeoutMs,
    );
  }

  throw new Error(`Unsupported provider: ${config.provider}`);
}

function logDispatch({
  emergencyLogId,
  userId,
  toPhone,
  provider,
  attempt,
  success,
  providerMessageId,
  errorMessage,
  responseBody,
}) {
  smsDispatchStatements.create.run({
    id: crypto.randomUUID(),
    emergency_log_id: emergencyLogId || null,
    user_id: userId,
    to_phone: toPhone,
    provider,
    attempt,
    success: success ? 1 : 0,
    provider_message_id: providerMessageId || null,
    error_message: errorMessage || null,
    response_body: responseBody ? JSON.stringify(responseBody) : null,
    created_at: nowIso(),
  });
}

async function sendToSingleContact({
  emergencyLogId,
  user,
  contact,
  message,
  policy,
  primary,
  fallback,
}) {
  let attempt = 0;
  const errors = [];

  const providers = [primary, fallback].filter((item) => item.provider !== 'none');

  for (const providerConfigItem of providers) {
    for (let retry = 1; retry <= policy.maxRetries; retry += 1) {
      attempt += 1;
      try {
        const sent = await sendWithProvider(
          providerConfigItem,
          {
            to: contact.phone,
            message,
          },
          policy.requestTimeoutMs,
        );

        logDispatch({
          emergencyLogId,
          userId: user._id,
          toPhone: contact.phone,
          provider: providerConfigItem.provider,
          attempt,
          success: true,
          providerMessageId: sent.providerMessageId,
          responseBody: { raw: sent.rawResponse },
        });

        return {
          to: contact.phone,
          success: true,
          provider: providerConfigItem.provider,
          providerMessageId: sent.providerMessageId,
          attempts: attempt,
          errors,
        };
      } catch (error) {
        const messageText = error?.message || 'Unknown SMS error';
        errors.push(`${providerConfigItem.provider}#${retry}: ${messageText}`);

        logDispatch({
          emergencyLogId,
          userId: user._id,
          toPhone: contact.phone,
          provider: providerConfigItem.provider,
          attempt,
          success: false,
          errorMessage: messageText,
        });

        if (retry < policy.maxRetries) {
          await sleep(policy.retryDelayMs);
        }
      }
    }
  }

  return {
    to: contact.phone,
    success: false,
    provider: 'none',
    providerMessageId: null,
    attempts: attempt,
    errors,
  };
}

async function sendEmergencySms({ emergencyLogId, user, contacts, location }) {
  const text = buildEmergencyMessage({ user, location });
  const policy = readPolicy();
  const primary = providerConfig('primary');
  const fallback = providerConfig('fallback');

  const validContacts = Array.isArray(contacts)
    ? contacts.filter((item) => item && item.phone)
    : [];

  const results = [];
  for (const contact of validContacts) {
    // eslint-disable-next-line no-await-in-loop
    const result = await sendToSingleContact({
      emergencyLogId,
      user,
      contact,
      message: text,
      policy,
      primary,
      fallback,
    });
    results.push(result);
  }

  return results;
}

module.exports = { sendEmergencySms };