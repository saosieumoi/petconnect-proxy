import '@shopify/shopify-api/adapters/node';
import 'dotenv/config';
import express from 'express';
import cors    from 'cors';
import jwt     from 'jsonwebtoken';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';

const { HOSTNAME, API_KEY, API_SECRET_KEY, ADMIN_TOKEN } = process.env;

/* 1 — Khởi tạo Shopify SDK */
const shopify = shopifyApi({
  apiKey: API_KEY,
  apiSecretKey: API_SECRET_KEY,
  hostName: HOSTNAME,
  scopes: ['write_customers'],
  isEmbeddedApp: false,
  apiVersion: LATEST_API_VERSION
});

/* 2 — Tạo app Express (phải đứng TRƯỚC khi dùng) */
const app = express();
app.use(cors());
app.use(express.json());

/* 3 — Middleware xác thực JWT */
function verifyJWT(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.jwtPayload = jwt.verify(token, API_SECRET_KEY);   // ghi vào request
    next();
  } catch {
    res.status(401).json({ ok: false, error: 'Bad JWT' });
  }
}

/* 4 — Route ghi Pet metaobject/metafield */
app.post('/update-pet', verifyJWT, async (req, res) => {
  const customerId = req.jwtPayload.sub;         // gid://shopify/Customer/…
  const pets = req.body.pets || {};

  const metafields = Object.entries(pets).map(([k, v]) => ({
    namespace: 'pets',
    key: k,
    type: k === 'age_month' ? 'number_integer'
         : k === 'weight'   ? 'number_decimal'
         : 'single_line_text_field',
    value: v.toString()
  }));

  const g = new shopify.clients.Graphql({ shop: SHOP, accessToken: ADMIN_TOKEN });
  await g.query({
    data: {
      query: `mutation ($id:ID!,$m:[MetafieldsSetInput!]!){
        metafieldsSet(ownerId:$id,metafields:$m){ userErrors{message} } }`,
      variables: { id: customerId, m: metafields }
    }
  });

  res.json({ ok: true });
});

/* 5 — Lắng cổng */
app.listen(process.env.PORT || 3000, () =>
  console.log('PetConnect API listening'));
