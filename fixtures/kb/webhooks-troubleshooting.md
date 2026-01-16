# Troubleshooting Webhook Delivery

This article helps resolve common webhook delivery problems and configuration issues.

## Webhooks Not Arriving

If your endpoint is not receiving webhook notifications, check these common causes first.

Troubleshooting steps:
1. Verify the endpoint URL is correct and uses HTTPS
2. Check that your server is accessible from the internet
3. Confirm the endpoint returns HTTP 200 status codes
4. Review firewall rules blocking incoming requests
5. Check the webhook delivery logs in the dashboard

Webhook deliveries are retried automatically on failure. Check the delivery history to see retry attempts and error messages.

## Signature Verification Failing

Webhook signature verification errors usually indicate a configuration mismatch between your endpoint and the platform.

Common verification problems:
- Wrong secret key: Each endpoint has a unique secret
- Modified payload: Verify the raw body before parsing JSON
- Encoding issues: Use UTF-8 encoding for signature computation
- Clock skew: Timestamps must be within 5 minutes

Regenerate your endpoint secret if verification continues to fail after checking these items.

## Slow Webhook Processing

Webhook deliveries time out after 30 seconds by default. Slow processing can cause missed notifications and excessive retries.

Recommendations for faster processing:
- Acknowledge receipt immediately with HTTP 200
- Queue events for background processing
- Avoid synchronous database operations in the handler
- Return quickly and process the event asynchronously
