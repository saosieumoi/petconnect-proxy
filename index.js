import '@shopify/shopify-api/adapters/node';
import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import fetch from 'node-fetch';
import shopifyPkg from '@shopify/shopify-api';

const { API_SECRET_KEY, ADMIN_TOKEN } = process.env;
const { utils } = shopifyPkg;

const app = express();
app.use(express.urlencoded({ extended: true }));

// ✅ Middleware: verify App Proxy signature from query string
function verifyProxy(req, res, next) {
  const { signature, ...rest } = req.query;
  const sortedQuery = Object.keys(rest)
    .sort()
    .map(k => `${k}=${rest[k]}`)
    .join('&');

  const digest = crypto
    .createHmac('sha256', API_SECRET_KEY)
    .update(sortedQuery)
    .digest('hex');

  if (digest !== signature) {
    console.warn('❌ Invalid App Proxy signature');
    return res.status(401).send('Invalid signature');
  }

  next();
}

// Optional: allow GET /update to show it's working
app.get('/update', (_, res) => {
  res.send('✅ PetConnect App Proxy is active. Use POST to save pet profile.');
});

// ✅ Main POST handler from App Proxy
app.post('/update', verifyProxy, async (req, res) => {
  const { shop, customerId } = req.query;
  const { name, breed, age_month, weight, play_style } = req.body;

  const metafields = [
    { namespace: 'pets', key: 'name',       type: 'single_line_text_field', value: name },
    { namespace: 'pets', key: 'breed',      type: 'single_line_text_field', value: breed },
    { namespace: 'pets', key: 'age_month',  type: 'number_integer',         value: age_month },
    { namespace: 'pets', key: 'weight',     type: 'number_decimal',         value: weight },
    { namespace: 'pets', key: 'play_style', type: 'single_line_text_field', value: play_style }
  ];

  const url = `https://${shop}/admin/api/2025-04/customers/${customerId}/metafields/set.json`;

  try {
    const rsp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': ADMIN_TOKEN
      },
      body: JSON.stringify({ metafields })
    });

    const responseText = await rsp.text();
    console.log('Shopify API status:', rsp.status);
    console.log('Response body:', responseText);

    if (!rsp.ok) {
      return res.status(500).send('❌ Shopify Admin API error');
    }

    return res.redirect(302, '/pages/pet-profile?saved=true');
  } catch (err) {
    console.error('❌ Server error:', err);
    return res.status(500).send('Internal server error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 PetConnect proxy running on port ${PORT}`));
