// server/index.js  (rút gọn, chỉ phần proxy route)
import '@shopify/shopify-api/adapters/node';
import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';

const { HOSTNAME, API_KEY, API_SECRET_KEY, ADMIN_TOKEN } = process.env;

const shopify = shopifyApi({
  apiKey: API_KEY,
  apiSecretKey: API_SECRET_KEY,
  hostName: HOSTNAME,
  scopes: ['write_customers'],
  isEmbeddedApp: false,
  apiVersion: LATEST_API_VERSION
});

const app = express();
app.use(express.urlencoded({ extended: true }));  // proxy sends form-urlencoded
app.use(express.json());

function verifyProxy(req, res, next) {
  const hmacHeader = req.get('X-Shopify-Proxy-Signature');
  const body = req.rawBody || '';        // express.urlencoded keeps raw in req.body?
  const digest = crypto
    .createHmac('sha256', API_SECRET_KEY)
    .update(body, 'utf8')
    .digest('base64');
  if (crypto.timingSafeEqual(Buffer.from(hmacHeader), Buffer.from(digest))) return next();
  return res.status(401).send('Bad proxy HMAC');
}

app.post('/update', verifyProxy, async (req, res) => {
  const customerId = `gid://shopify/Customer/${req.body.customer_id}`;   // Shopify adds param
  const pets = JSON.parse(req.body.data);

  const metafields = Object.entries(pets).map(([k, v]) => ({
    namespace: 'pets',
    key: k,
    type: k==='age_month'?'number_integer':k==='weight'?'number_decimal':'single_line_text_field',
    value: v.toString()
  }));

  const g = new shopify.clients.Graphql({ shop: SHOP, accessToken: ADMIN_TOKEN });
  await g.query({
    data:{ query:`mutation($id:ID!,$m:[MetafieldsSetInput!]!){
      metafieldsSet(ownerId:$id,metafields:$m){userErrors{message}}}`,
      variables:{ id: customerId, m: metafields } }
  });
  res.json({ ok:true });
});

app.get('/', (req,res)=>res.send('PetConnect proxy OK'));
app.listen(process.env.PORT||3000);
