import '@shopify/shopify-api/adapters/node';
import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import fetch from 'node-fetch';

const { API_SECRET_KEY, ADMIN_TOKEN } = process.env;
const app = express();

app.use(express.urlencoded({ extended: true }));   // nhận form-urlencoded

/* ---------- HMAC verify ---------- */
function verifyProxy(req, res, next) {
  const sig = req.get('X-Shopify-Proxy-Signature');
  if (!sig) return res.status(401).send('Missing signature');

  const sorted = Object.keys(req.query)
    .sort()
    .map(k => `${k}=${req.query[k]}`)
    .join('&');

  const msg = `${req.path}?${sorted}`;       // <path>?<sorted_query>
  const digest = crypto
    .createHmac('sha256', API_SECRET_KEY)
    .update(msg)
    .digest('base64');

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest)))
    return res.status(401).send('Bad proxy HMAC');

  return next();
}

app.get('/update', (_, res) => res.send('PetConnect proxy endpoint – POST only.'));

/* ---------- Proxy endpoint ---------- */
app.post('/update', verifyProxy, async (req, res) => {
  const { shop, customerId } = req.query;              // lấy từ URL của form
  const { name, breed, age_month, weight, play_style } = req.body;

  const metafields = [
    { namespace:'pets', key:'name',       type:'single_line_text_field', value:name       },
    { namespace:'pets', key:'breed',      type:'single_line_text_field', value:breed      },
    { namespace:'pets', key:'age_month',  type:'number_integer',         value:age_month  },
    { namespace:'pets', key:'weight',     type:'number_decimal',         value:weight     },
    { namespace:'pets', key:'play_style', type:'single_line_text_field', value:play_style }
  ];

  try {
    const rsp = await fetch(
      `https://${shop}/admin/api/2025-04/customers/${customerId}/metafields/set.json`,
      {
        method : 'POST',
        headers: {
          'Content-Type'          : 'application/json',
          'X-Shopify-Access-Token': ADMIN_TOKEN
        },
        body: JSON.stringify({ metafields })
      }
    );

    if (!rsp.ok) {
      console.error(await rsp.text());
      return res.status(500).send('Admin API error');
    }

    // thành công → redirect về trang profile kèm saved=true
    return res.redirect(302, '/pages/pet-profile?saved=true');
  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error');
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Proxy listening'));
