# Domain Migration Guide

## Switching from localhost:3001 to www.aisummarizer-descript.com

This document outlines the steps needed to migrate from localhost:3001 to the new domain www.aisummarizer-descript.com

## Changes Made

1. Updated domain references in:
   - server.js
   - API routes for OAuth integrations (Monday, Attio)
   - package.json scripts with environment variables

## Additional Required Changes

1. DNS Configuration:
   - A records for www.aisummarizer-descript.com should point to your server IP
   - CNAME record for aisummarizer-descript.com should point to www.aisummarizer-descript.com

2. SSL Certificate:
   - Obtain proper SSL certificates for www.aisummarizer-descript.com
   - Replace the dev key.pem and cert.pem files with production certificates

3. Environment Variables:
   - Set NEXT_PUBLIC_BASE_URL=https://www.aisummarizer-descript.com in deployment environment

4. OAuth Configuration:
   - Update redirect URIs in each OAuth provider (Monday, Attio, etc.) to use the new domain

## Potential Issues

1. Cross-Origin Requests: Ensure CORS is properly configured for the new domain
2. Cookies: Some cookies may still reference localhost, requiring user relogin
3. Hard-coded URLs: Search for any remaining localhost:3001 references in code

## Testing

Before fully switching, test all integrations with the new domain:

1. Calendar connections
2. OAuth flows for all integrations
3. API endpoints
4. Frontend functionality
