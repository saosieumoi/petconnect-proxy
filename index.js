import '@shopify/shopify-api/adapters/node';
import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import fetch from 'node-fetch';
import shopifyPkg from '@shopify/shopify-api';
const { utils } = shopifyPkg;

const { API_SECRET_KEY, ADMIN_TOKEN } = process.env;
const app = express();

app.use(express.urlencoded({ extended: true })); // nhận form data từ HTML form

// ✅ Middleware kiểm tra App Proxy signature từ query string
function verifyProxy(req, res, next) {
  const isValid = utils.validateHmac(req.query, API_SECRET_KEY);
  if (!isValid) {
    console.warn('Invalid App Proxy signature', req.query);
    return res.status(401).send('Invalid signature');
  }
  next();
}

// GET /update → test endpoint (tùy chọn)
app.get('/update', (_, res) => {
  res.send('PetConnect App Proxy – use POST to save pet profile.');
});

// POST /update → nhận dữ liệu từ Shopify Proxy
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

  try {
    const rsp = await fetch(
      `https://${shop}/admin/api/2025-04/customers/${customerId}/metafields/set.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': ADMIN_TOKEN
        },
        body: JSON.stringify({ metafields })
      }
    );

    try {
    const rsp = await fetch(
      `https://${shop}/admin/api/2025-04/customers/${customerId}/metafields/set.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': ADMIN_TOKEN
        },
        body: JSON.stringify({ metafields })
      }
    );

    if (!rsp.ok) {
      const errorText = await rsp.text();
      console.error('Admin API error:', errorText);
      return res.status(500).send('Shopify Admin API error');
    }

    return res.redirect(302, '/pages/pet-profile?saved=true');
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).send('Internal server error');
  }
});

// Start server
app.listen(process.env.PORT || 3000, () => {
  console.log('PetConnect App Proxy server running');
});
