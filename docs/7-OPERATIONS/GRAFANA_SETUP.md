# Grafana Cloud Setup Guide

This guide explains how to set up Grafana Cloud (FREE tier) for monitoring SpediReSicuro business metrics.

## Prerequisites

- SpediReSicuro deployed and running
- Access to environment variables
- Email for Grafana Cloud account

## 1. Create Grafana Cloud Account

1. Go to [Grafana Cloud](https://grafana.com/auth/sign-up/create-user)
2. Sign up for a **FREE** account
3. Choose a stack name (e.g., `spediresicuro`)
4. Select the closest region (e.g., `eu-west-1` for Europe)

### Free Tier Limits
- **10,000 active metric series**
- **14-day retention**
- **50GB logs/month** (with Loki)
- **500 VUh/month** for k6

## 2. Configure Prometheus Data Source

### Option A: Remote Write (Push Metrics)

Not recommended for FREE tier due to complexity.

### Option B: Prometheus Scraping (Recommended)

1. In Grafana Cloud, go to **Connections** → **Data Sources**
2. Add a new **Prometheus** data source
3. Configure scrape job:

```yaml
# prometheus.yml configuration (if self-hosted)
scrape_configs:
  - job_name: 'spediresicuro'
    scrape_interval: 60s
    scheme: https
    static_configs:
      - targets: ['spediresicuro.it']
    metrics_path: '/api/metrics/prometheus'
    authorization:
      type: Bearer
      credentials: '<METRICS_API_TOKEN>'
```

### For Grafana Cloud Agent

1. Install Grafana Agent on a server or use Grafana Cloud's hosted agent
2. Configure the agent:

```yaml
# agent.yaml
metrics:
  configs:
    - name: spediresicuro
      scrape_configs:
        - job_name: 'spediresicuro-metrics'
          scrape_interval: 60s
          static_configs:
            - targets: ['spediresicuro.it']
          metrics_path: '/api/metrics/prometheus'
          scheme: https
          authorization:
            type: Bearer
            credentials_file: /etc/grafana/metrics_token
      remote_write:
        - url: https://prometheus-prod-XX-XXX.grafana.net/api/prom/push
          basic_auth:
            username: <GRAFANA_CLOUD_USER>
            password: <GRAFANA_CLOUD_API_KEY>
```

## 3. Environment Variables

Add these to your Vercel project:

```bash
# Grafana Cloud (optional - only needed for push metrics)
GRAFANA_CLOUD_URL=https://your-stack.grafana.net
GRAFANA_CLOUD_USER=your-user-id
GRAFANA_CLOUD_API_KEY=glc_your_api_key

# Metrics API Security (REQUIRED)
METRICS_API_TOKEN=<generate-a-secure-token>
```

### Generate Secure Token

```bash
# Generate a random token
openssl rand -base64 32
```

## 4. Import Dashboard

### Dashboard JSON

Import the following dashboard into Grafana:

```json
{
  "title": "SpediReSicuro Business Metrics",
  "uid": "spedire-business",
  "tags": ["spediresicuro", "business"],
  "timezone": "browser",
  "panels": [
    {
      "title": "Shipments Today",
      "type": "stat",
      "gridPos": { "h": 4, "w": 4, "x": 0, "y": 0 },
      "targets": [
        {
          "expr": "spedire_shipments_created{period=\"today\"}",
          "legendFormat": "Today"
        }
      ],
      "options": {
        "colorMode": "value",
        "graphMode": "area"
      }
    },
    {
      "title": "Revenue Today (EUR)",
      "type": "stat",
      "gridPos": { "h": 4, "w": 4, "x": 4, "y": 0 },
      "targets": [
        {
          "expr": "spedire_revenue_eur{period=\"today\"}",
          "legendFormat": "Revenue"
        }
      ],
      "options": {
        "colorMode": "value",
        "graphMode": "area"
      },
      "fieldConfig": {
        "defaults": {
          "unit": "currencyEUR"
        }
      }
    },
    {
      "title": "Success Rate",
      "type": "gauge",
      "gridPos": { "h": 4, "w": 4, "x": 8, "y": 0 },
      "targets": [
        {
          "expr": "spedire_shipments_success_rate",
          "legendFormat": "Success Rate"
        }
      ],
      "options": {
        "showThresholdLabels": false,
        "showThresholdMarkers": true
      },
      "fieldConfig": {
        "defaults": {
          "unit": "percentunit",
          "min": 0,
          "max": 1,
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "red", "value": null },
              { "color": "yellow", "value": 0.8 },
              { "color": "green", "value": 0.95 }
            ]
          }
        }
      }
    },
    {
      "title": "Pending Top-ups",
      "type": "stat",
      "gridPos": { "h": 4, "w": 4, "x": 12, "y": 0 },
      "targets": [
        {
          "expr": "spedire_topups_pending",
          "legendFormat": "Pending"
        }
      ],
      "options": {
        "colorMode": "value"
      },
      "fieldConfig": {
        "defaults": {
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 5 },
              { "color": "red", "value": 10 }
            ]
          }
        }
      }
    },
    {
      "title": "Shipments by Status",
      "type": "piechart",
      "gridPos": { "h": 8, "w": 8, "x": 0, "y": 4 },
      "targets": [
        {
          "expr": "spedire_shipments_total",
          "legendFormat": "{{status}}"
        }
      ],
      "options": {
        "legend": {
          "displayMode": "table",
          "placement": "right"
        }
      }
    },
    {
      "title": "Revenue Trend",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 8, "x": 8, "y": 4 },
      "targets": [
        {
          "expr": "spedire_revenue_eur{period=\"today\"}",
          "legendFormat": "Today"
        },
        {
          "expr": "spedire_revenue_eur{period=\"week\"}",
          "legendFormat": "This Week"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "currencyEUR"
        }
      }
    },
    {
      "title": "Active Users (30d)",
      "type": "stat",
      "gridPos": { "h": 4, "w": 4, "x": 16, "y": 0 },
      "targets": [
        {
          "expr": "spedire_users_active{period=\"30d\"}",
          "legendFormat": "Active"
        }
      ]
    },
    {
      "title": "Total Wallet Balance",
      "type": "stat",
      "gridPos": { "h": 4, "w": 4, "x": 20, "y": 0 },
      "targets": [
        {
          "expr": "spedire_wallet_balance_total_eur",
          "legendFormat": "Balance"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "currencyEUR"
        }
      }
    }
  ],
  "refresh": "1m",
  "time": {
    "from": "now-24h",
    "to": "now"
  }
}
```

### Import Steps

1. In Grafana, go to **Dashboards** → **Import**
2. Paste the JSON above
3. Select your Prometheus data source
4. Click **Import**

## 5. Set Up Alerts (Optional)

### Alert Rules

Create alerts for critical business metrics:

```yaml
# Example alert rules
groups:
  - name: SpediReSicuro Business Alerts
    rules:
      - alert: HighPendingTopups
        expr: spedire_topups_pending > 20
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "High number of pending top-ups"
          description: "{{ $value }} top-up requests are pending"

      - alert: LowSuccessRate
        expr: spedire_shipments_success_rate < 0.9
        for: 1h
        labels:
          severity: critical
        annotations:
          summary: "Shipment success rate below 90%"
          description: "Current success rate: {{ $value | humanizePercentage }}"

      - alert: NoShipmentsToday
        expr: spedire_shipments_created{period="today"} == 0
        for: 6h
        labels:
          severity: warning
        annotations:
          summary: "No shipments created today"
```

### Contact Points

1. Go to **Alerting** → **Contact points**
2. Add Slack webhook (from M1)
3. Create notification policy

## 6. Verify Integration

### Test Prometheus Endpoint

```bash
# Test locally
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://spediresicuro.it/api/metrics/prometheus

# Expected output:
# HELP spedire_shipments_total Total number of shipments by status
# TYPE spedire_shipments_total gauge
spedire_shipments_total{status="delivered"} 1234
...
```

### Test Dashboard

1. Open Grafana dashboard
2. Verify all panels show data
3. Check that refresh works

## Troubleshooting

### No Data in Dashboard

1. Check Prometheus scrape status
2. Verify METRICS_API_TOKEN is correct
3. Check Vercel function logs for errors

### 401 Unauthorized

1. Verify Bearer token format: `Authorization: Bearer <token>`
2. Check METRICS_API_TOKEN environment variable

### Rate Limiting (429)

The endpoint is limited to 60 requests/minute per IP. Ensure scrape interval is >= 60s.

### High Latency

Metrics queries can take 1-5 seconds on large datasets. This is normal for the FREE tier.

## Cost Summary

| Service | Tier | Cost | Usage |
|---------|------|------|-------|
| Grafana Cloud | FREE | €0/month | 10K series, 14d retention |
| Prometheus endpoint | N/A | €0/month | Self-hosted in Vercel |

**Total M4 cost: €0/month**

## Related Documentation

- [MONITORING_M1_IMPLEMENTATION.md](../../MONITORING_M1_IMPLEMENTATION.md) - Sentry & Health Checks
- [MONITORING_M2_IMPLEMENTATION.md](../../MONITORING_M2_IMPLEMENTATION.md) - APM & Logging
- [MONITORING_M3_IMPLEMENTATION.md](../../MONITORING_M3_IMPLEMENTATION.md) - Uptime Monitoring
- [MONITORING_M4_IMPLEMENTATION.md](../../MONITORING_M4_IMPLEMENTATION.md) - Business Dashboards
