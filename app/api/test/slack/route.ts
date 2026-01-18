import { NextRequest, NextResponse } from 'next/server';

/**
 * Test endpoint per verificare Slack webhook
 *
 * GET /api/test/slack - Invia un messaggio di test a Slack
 */
export async function GET(request: NextRequest) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      {
        error: 'SLACK_WEBHOOK_URL not configured',
        message: 'Please add SLACK_WEBHOOK_URL to your .env.local file',
      },
      { status: 500 }
    );
  }

  try {
    // Messaggio di test formattato
    const message = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🧪 Slack Integration Test',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*Status:*\n✅ Webhook working',
            },
            {
              type: 'mrkdwn',
              text: `*Time:*\n${new Date().toLocaleString('it-IT')}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'If you see this message, your Slack integration is working correctly! 🎉',
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '🚀 SpediRe Sicuro - Enterprise Monitoring',
            },
          ],
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Slack API error: ${response.status} - ${errorText}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Test message sent to Slack successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Slack test error:', error);

    return NextResponse.json(
      {
        error: 'Failed to send message to Slack',
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
