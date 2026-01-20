#!/usr/bin/env tsx
/**
 * Generate OpenAPI 3.0 schema from TypeScript types
 *
 * Usage: npm run generate:openapi
 */

import fs from 'fs';
import path from 'path';

const openApiSchema = {
  openapi: '3.0.0',
  info: {
    title: 'SpedireSicuro API',
    version: '1.0.0',
    description: 'RESTful API for SpedireSicuro logistics platform',
    contact: {
      name: 'API Support',
      email: 'api-support@spediresicuro.it',
      url: 'https://github.com/gdsgroupsas-jpg/spediresicuro',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    {
      url: 'https://spediresicuro.vercel.app/api',
      description: 'Production',
    },
    {
      url: 'http://localhost:3000/api',
      description: 'Development',
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        description: 'Check API and services health status',
        tags: ['System'],
        responses: {
          '200': {
            description: 'Healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                    services: {
                      type: 'object',
                      properties: {
                        database: { type: 'string', example: 'healthy' },
                        ai: { type: 'string', example: 'healthy' },
                        cache: { type: 'string', example: 'healthy' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/pricing/quote': {
      post: {
        summary: 'Get price quote',
        description: 'Calculate shipping price for given parameters',
        tags: ['Pricing'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['weight', 'origin', 'destination'],
                properties: {
                  weight: {
                    type: 'number',
                    description: 'Package weight in kg',
                    example: 5.0,
                  },
                  dimensions: {
                    type: 'object',
                    properties: {
                      length: { type: 'number', example: 30 },
                      width: { type: 'number', example: 20 },
                      height: { type: 'number', example: 10 },
                    },
                  },
                  origin: {
                    type: 'object',
                    required: ['zip'],
                    properties: {
                      country: { type: 'string', example: 'IT' },
                      zip: { type: 'string', example: '20100' },
                    },
                  },
                  destination: {
                    type: 'object',
                    required: ['zip'],
                    properties: {
                      country: { type: 'string', example: 'IT' },
                      zip: { type: 'string', example: '00100' },
                    },
                  },
                  serviceType: {
                    type: 'string',
                    enum: ['standard', 'express'],
                    default: 'standard',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Quote calculated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    quoteId: { type: 'string', example: 'quote_abc123' },
                    prices: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          courier: { type: 'string', example: 'poste' },
                          service: { type: 'string', example: 'Pacco Ordinario' },
                          price: {
                            type: 'object',
                            properties: {
                              net: { type: 'number', example: 8.5 },
                              vat: { type: 'number', example: 1.87 },
                              total: { type: 'number', example: 10.37 },
                              currency: { type: 'string', example: 'EUR' },
                            },
                          },
                          deliveryDays: { type: 'string', example: '3-5' },
                          trackingIncluded: { type: 'boolean', example: true },
                        },
                      },
                    },
                    expiresAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid request' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/shipments': {
      get: {
        summary: 'List shipments',
        description: 'Get paginated list of shipments',
        tags: ['Shipments'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20, maximum: 100 },
          },
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['pending', 'in_transit', 'delivered', 'cancelled'],
            },
          },
        ],
        responses: {
          '200': {
            description: 'List of shipments',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    shipments: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Shipment' },
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer' },
                        page: { type: 'integer' },
                        pages: { type: 'integer' },
                        limit: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create shipment',
        description: 'Create a new shipment from a price quote',
        tags: ['Shipments'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['quoteId', 'courierSelection', 'sender', 'recipient'],
                properties: {
                  quoteId: { type: 'string', example: 'quote_abc123' },
                  courierSelection: { type: 'string', example: 'poste' },
                  sender: { $ref: '#/components/schemas/Address' },
                  recipient: { $ref: '#/components/schemas/Address' },
                  package: {
                    type: 'object',
                    properties: {
                      description: { type: 'string', example: 'Electronics' },
                      value: { type: 'number', example: 150.0 },
                      insurance: { type: 'boolean', default: false },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Shipment created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Shipment' },
              },
            },
          },
          '400': { description: 'Invalid request' },
          '402': { description: 'Insufficient wallet balance' },
        },
      },
    },
    '/wallet/balance': {
      get: {
        summary: 'Get wallet balance',
        tags: ['Wallet'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Current balance',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    balance: { type: 'number', example: 150.5 },
                    currency: { type: 'string', example: 'EUR' },
                    lastTransaction: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
      },
    },
    schemas: {
      Address: {
        type: 'object',
        required: ['name', 'address', 'city', 'zip', 'country'],
        properties: {
          name: { type: 'string', example: 'Mario Rossi' },
          company: { type: 'string', example: 'Acme Inc' },
          address: { type: 'string', example: 'Via Roma 1' },
          city: { type: 'string', example: 'Milano' },
          zip: { type: 'string', example: '20100' },
          country: { type: 'string', example: 'IT' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string', example: '+39 02 1234567' },
        },
      },
      Shipment: {
        type: 'object',
        properties: {
          shipmentId: { type: 'string', example: 'ship_xyz789' },
          status: {
            type: 'string',
            enum: ['created', 'pending', 'in_transit', 'delivered', 'cancelled'],
          },
          trackingNumber: { type: 'string', example: 'IT1234567890' },
          courier: { type: 'string', example: 'poste' },
          createdAt: { type: 'string', format: 'date-time' },
          estimatedDelivery: { type: 'string', format: 'date' },
        },
      },
    },
  },
};

const outputPath = path.join(process.cwd(), 'public', 'openapi.json');

// Ensure public directory exists
const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(openApiSchema, null, 2));

console.log('✅ OpenAPI schema generated at:', outputPath);
console.log('📖 View at: http://localhost:3000/openapi.json');
