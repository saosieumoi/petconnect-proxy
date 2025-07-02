import express from 'express';
import crypto from 'crypto';
import fetch from 'node-fetch';
import 'dotenv/config';

const { API_SECRET_KEY, ADMIN_TOKEN } = process.env;
const app = express();
app.use(express.urlencoded({ extended: true }));

// Verify HMAC from Shopify App Proxy
function verifyProxy(req, res, next) {
  const sig = req.get('x-shopify-proxy-signature');
  if (!sig) return res.status(401).send('Missing signature');

  const sorted = Object.keys(req.query).sort().map(k => `${k}=${req.query[k]}`).join('&');
  const msg = `${req.path}?${sorted}`;
  const digest = crypto.createHmac('sha256', API_SECRET_KEY).update(msg).digest('base64');

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest)))
    return res.status(401).send('Bad signature');

  return next();
}

app.post('/update', verifyProxy, async (req, res) => {
  const { shop, customerId } = req.query;
  const { name, breed, play_style } = req.body;

  const metafields = [
    { namespace: 'pets', key: 'name', type: 'single_line_text_field', value: name },
    { namespace: 'pets', key: 'breed', type: 'single_line_text_field', value: breed },
    { namespace: 'pets', key: 'play_style', type: 'single_line_text_field', value: play_style }
  ];

  try {
    const rsp = await fetch(
      `https://${shop}/admin/api/2025-04/customers/${customerId}/metafields/set.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': ADMIN_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ metafields })
      }
    );

    console.log('Incoming headers:', req.headers);
    console.log('Original URL:', req.originalUrl);

    if (!rsp.ok) {
      console.error(await rsp.text());
      return res.status(500).send('Shopify API error');
    }

    return res.redirect(302, '/pages/pet-profile?saved=true');
  } catch (e) {
    console.error(e);
    return res.status(500).send('Server error');
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Proxy server running'));
