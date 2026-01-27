// Email service using Resend
import { Resend } from 'resend';
import { BookedSlot, SchedulerConfig } from './types';

// Lazy-load Resend client to avoid build-time initialization errors
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const getFromEmail = () => process.env.EMAIL_FROM || 'noreply@example.com';

// Format time for display
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Format date for display (parse as local date, not UTC)
function formatDate(dateStr: string): string {
  // Parse YYYY-MM-DD format manually to avoid timezone issues
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month is 0-indexed
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Generate confirmation email HTML for client
function generateClientConfirmationEmail(booking: BookedSlot, config: SchedulerConfig): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, ${config.primaryColor}, ${config.accentColor});">
        ${config.logo ? `<img src="${config.logo}" alt="${config.businessName}" style="max-height: 50px; margin-bottom: 20px;">` : ''}
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Booking Confirmed!</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          Hi ${booking.clientName},
        </p>
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 32px;">
          Your meeting with <strong>${config.businessName}</strong> has been confirmed. Here are the details:
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="padding: 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: #6b7280; font-size: 14px;">Meeting Type</span>
                    <p style="color: ${config.accentColor}; font-size: 18px; font-weight: 600; margin: 4px 0 0;">${booking.meetingType}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: #6b7280; font-size: 14px;">Date</span>
                    <p style="color: #1f2937; font-size: 16px; margin: 4px 0 0;">${formatDate(booking.date)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: #6b7280; font-size: 14px;">Time</span>
                    <p style="color: #1f2937; font-size: 16px; margin: 4px 0 0;">${formatTime(booking.time)} (${config.timezone})</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: #6b7280; font-size: 14px;">Duration</span>
                    <p style="color: #1f2937; font-size: 16px; margin: 4px 0 0;">${booking.duration} minutes</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        ${booking.notes ? `
        <div style="margin-top: 24px; padding: 16px; background-color: #fef3c7; border-radius: 8px;">
          <p style="color: #92400e; font-size: 14px; margin: 0;"><strong>Your Notes:</strong></p>
          <p style="color: #78350f; font-size: 14px; margin: 8px 0 0;">${booking.notes}</p>
        </div>
        ` : ''}

        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 32px 0 0;">
          A calendar invitation has been sent to your email. If you need to reschedule or cancel, please contact us directly.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 30px; background-color: #f8fafc; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} ${config.businessName}. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Generate notification email HTML for admin
function generateAdminNotificationEmail(booking: BookedSlot, config: SchedulerConfig): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Booking Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, ${config.primaryColor}, ${config.accentColor});">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">📅 New Booking!</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          You have a new meeting scheduled:
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 12px; border-left: 4px solid #10b981; overflow: hidden;">
          <tr>
            <td style="padding: 24px;">
              <h2 style="color: #065f46; margin: 0 0 16px; font-size: 20px;">${booking.meetingType}</h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Client:</td>
                  <td style="padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${booking.clientName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Email:</td>
                  <td style="padding: 6px 0; color: #1f2937; font-size: 14px;"><a href="mailto:${booking.clientEmail}" style="color: ${config.accentColor};">${booking.clientEmail}</a></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Date:</td>
                  <td style="padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${formatDate(booking.date)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Time:</td>
                  <td style="padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${formatTime(booking.time)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Duration:</td>
                  <td style="padding: 6px 0; color: #1f2937; font-size: 14px;">${booking.duration} minutes</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        ${booking.notes ? `
        <div style="margin-top: 24px; padding: 16px; background-color: #f3f4f6; border-radius: 8px;">
          <p style="color: #374151; font-size: 14px; margin: 0;"><strong>Client Notes:</strong></p>
          <p style="color: #4b5563; font-size: 14px; margin: 8px 0 0;">${booking.notes}</p>
        </div>
        ` : ''}

        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 32px 0 0;">
          This event has been added to your Outlook calendar.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 30px; background-color: #f8fafc; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          Calendar Scheduler • ${new Date().toISOString()}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Send confirmation email to client
export async function sendClientConfirmation(booking: BookedSlot, config: SchedulerConfig): Promise<void> {
  if (process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') {
    console.log('Email notifications disabled');
    return;
  }

  const html = generateClientConfirmationEmail(booking, config);

  try {
    await getResendClient().emails.send({
      from: `${config.businessName} <${getFromEmail()}>`,
      to: booking.clientEmail,
      subject: `Booking Confirmed: ${booking.meetingType} on ${formatDate(booking.date)}`,
      html,
    });
    console.log(`Confirmation email sent to ${booking.clientEmail}`);
  } catch (error) {
    console.error('Failed to send client confirmation email:', error);
    throw error;
  }
}

// Send notification email to admin
export async function sendAdminNotification(booking: BookedSlot, config: SchedulerConfig): Promise<void> {
  if (process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') {
    console.log('Email notifications disabled');
    return;
  }

  const adminEmail = config.outlookEmail || process.env.ADMIN_EMAIL;
  
  if (!adminEmail) {
    console.log('No admin email configured');
    return;
  }

  const html = generateAdminNotificationEmail(booking, config);

  try {
    await getResendClient().emails.send({
      from: `Calendar Scheduler <${getFromEmail()}>`,
      to: adminEmail,
      subject: `New Booking: ${booking.clientName} - ${booking.meetingType}`,
      html,
    });
    console.log(`Admin notification email sent to ${adminEmail}`);
  } catch (error) {
    console.error('Failed to send admin notification email:', error);
    throw error;
  }
}

// Send both confirmation and notification emails
export async function sendBookingEmails(booking: BookedSlot, config: SchedulerConfig): Promise<void> {
  await Promise.all([
    sendClientConfirmation(booking, config),
    sendAdminNotification(booking, config),
  ]);
}

// Send cancellation email
export async function sendCancellationEmail(booking: BookedSlot, config: SchedulerConfig): Promise<void> {
  if (process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') {
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Booking Cancelled</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #ef4444, #b91c1c);">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Booking Cancelled</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
          Hi ${booking.clientName},
        </p>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
          Your ${booking.meetingType} scheduled for ${formatDate(booking.date)} at ${formatTime(booking.time)} has been cancelled.
        </p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
          If you'd like to reschedule, please visit our booking page.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await getResendClient().emails.send({
    from: `${config.businessName} <${getFromEmail()}>`,
    to: booking.clientEmail,
    subject: `Booking Cancelled: ${booking.meetingType}`,
    html,
  });
}

// Send welcome email to new admin user with temporary password
export async function sendNewUserEmail(
  email: string,
  name: string,
  tempPassword: string,
  config: SchedulerConfig
): Promise<void> {
  const loginUrl = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/admin` : '/admin';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${config.businessName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, ${config.primaryColor}, ${config.accentColor});">
        ${config.logo ? `<img src="${config.logo}" alt="${config.businessName}" style="max-height: 50px; margin-bottom: 20px;">` : ''}
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Welcome!</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          Hi ${name},
        </p>
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          You have been added as an administrator for <strong>${config.businessName}</strong>'s scheduling system.
        </p>
        
        <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;">Your temporary password:</p>
          <p style="color: ${config.accentColor}; font-size: 24px; font-weight: 600; font-family: monospace; margin: 0; letter-spacing: 2px;">${tempPassword}</p>
        </div>
        
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          For security reasons, you will be required to change this password when you first log in.
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${loginUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, ${config.accentColor}, ${config.primaryColor}); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Log In Now
          </a>
        </div>
        
        <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin-top: 32px;">
          If you didn't expect this email, please contact your administrator.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 30px; background-color: #f8fafc; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} ${config.businessName}. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await getResendClient().emails.send({
    from: `${config.businessName} <${getFromEmail()}>`,
    to: email,
    subject: `Welcome to ${config.businessName} - Your Admin Account`,
    html,
  });
}

// Send password reset email
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetUrl: string,
  config: SchedulerConfig
): Promise<void> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, ${config.primaryColor}, ${config.accentColor});">
        ${config.logo ? `<img src="${config.logo}" alt="${config.businessName}" style="max-height: 50px; margin-bottom: 20px;">` : ''}
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Password Reset</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          Hi ${name},
        </p>
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          We received a request to reset your password for your <strong>${config.businessName}</strong> admin account.
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, ${config.accentColor}, ${config.primaryColor}); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Reset Password
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0;">
          This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
        </p>
        
        <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin-top: 32px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <span style="color: #6b7280; word-break: break-all;">${resetUrl}</span>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 30px; background-color: #f8fafc; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} ${config.businessName}. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await getResendClient().emails.send({
    from: `${config.businessName} <${getFromEmail()}>`,
    to: email,
    subject: `Password Reset - ${config.businessName}`,
    html,
  });
}
