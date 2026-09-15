import nodemailer from 'nodemailer';

let transporter = null;
let mode = 'console';

function init() {
  if (transporter !== null) return;
  const host = process.env.SMTP_HOST;
  if (!host) {
    mode = 'console';
    transporter = false; // sentinel: SMTP disabled
    return;
  }
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  mode = 'smtp';
}

function recipientToAddresses(recipient) {
  const map = {
    vendor: process.env.ECN_VENDOR_EMAILS,
    oem: process.env.ECN_OEM_EMAILS,
    quality: process.env.ECN_QUALITY_EMAILS,
    sales: process.env.ECN_SALES_EMAILS,
  };
  if (recipient in map) {
    return (map[recipient] || '').split(',').map((s) => s.trim()).filter(Boolean);
  }
  // assume recipient is a raw email or comma-separated emails
  return recipient.split(',').map((s) => s.trim()).filter(Boolean);
}

function buildEcnEmail({ ecr, recipient }) {
  const subject = `[ECN] ${ecr.ecrNumber} — ${ecr.title}`;
  const body = `
Engineering Change Notice / Thông báo thay đổi kỹ thuật
========================================================

ECR number: ${ecr.ecrNumber}
Title:      ${ecr.title}
Type:       ${ecr.changeType}
Priority:   ${ecr.priority}
Status:     ${ecr.status}

Reason / Lý do:
${ecr.reason || '-'}

${ecr.description ? 'Description / Mô tả:\n' + ecr.description + '\n\n' : ''}This ECN was sent to: ${recipient}

— Drawing Tool / Forte Biotech
`.trim();
  return { subject, text: body };
}

export async function sendEcnNotification({ ecr, recipient }) {
  init();
  const to = recipientToAddresses(recipient);
  const { subject, text } = buildEcnEmail({ ecr, recipient });
  const from = process.env.SMTP_FROM || 'Drawing Tool <no-reply@local>';

  if (mode === 'smtp' && to.length > 0) {
    await transporter.sendMail({ from, to: to.join(','), subject, text });
    return { mode: 'smtp', to, subject };
  }
  // console / dev mode
  console.log(`\n=== [ECN MAIL] mode=${mode}, recipient="${recipient}", to=${JSON.stringify(to)} ===`);
  console.log(`Subject: ${subject}`);
  console.log(text);
  console.log('=== END ECN MAIL ===\n');
  return { mode, to, subject };
}

export function notifierStatus() {
  init();
  return {
    mode,
    host: process.env.SMTP_HOST || null,
    from: process.env.SMTP_FROM || null,
    groups: {
      vendor: (process.env.ECN_VENDOR_EMAILS || '').split(',').filter(Boolean).length,
      oem: (process.env.ECN_OEM_EMAILS || '').split(',').filter(Boolean).length,
      quality: (process.env.ECN_QUALITY_EMAILS || '').split(',').filter(Boolean).length,
      sales: (process.env.ECN_SALES_EMAILS || '').split(',').filter(Boolean).length,
    },
  };
}
