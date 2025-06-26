import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { shopifyApi, LATEST_API_VERSION, jwtDecode } from '@shopify/shopify-api';

const { SHOP, API_KEY, API_SECRET_KEY, ADMIN_TOKEN } = process.env;

const app = express();
app.use(cors());
app.use(express.json());

/* ---------- minimal Shopify context (for JWT verify) ---------- */
const shopify = shopifyApi({
  apiKey: API_KEY,
  apiSecretKey: API_SECRET_KEY,
  scopes: ['write_customers'],
  isEmbeddedApp: true,
  apiVersion: LATEST_API_VERSION
});

/* ---------- util: verify Customer Account JWT ---------- */
async function verifyCustomerJWT(token) {
  try {
    const decoded = jwtDecode(token);
    // Optional: check decoded.dest === SHOP and token not expired
    return decoded;                       // customer id in "sub"
  } catch {
    return null;
  }
}

/* ---------- POST /update-pet ---------- */
app.post('/update-pet', async (req, res) => {
  const { authorization } = req.headers;          // "Bearer <JWT>"
  if (!authorization) return res.status(401).json({ ok: false, error: 'No JWT' });
  const jwt = authorization.split(' ')[1];

  const decoded = await verifyCustomerJWT(jwt);
  if (!decoded) return res.status(401).json({ ok: false, error: 'Bad JWT' });

  const customerId = decoded.sub;                 // gid://shopify/Customer/123456
  const pets       = req.body.pets || {};

  /* build metafields array */
  const mf = Object.entries(pets).map(([k, v]) => ({
    namespace: 'pets',
    key: k,
    type:
      k === 'age_month' ? 'number_integer' :
      k === 'weight'    ? 'number_decimal' :
      'single_line_text_field',
    value: v.toString()
  }));

  /* call Admin GraphQL */
  const client = new shopify.clients.Graphql({ shop: SHOP, accessToken: ADMIN_TOKEN });

  const { metafieldsSet } = await client.query({
    data: {
      query: `mutation ($id:ID!,$m:[MetafieldsSetInput!]!){
        metafieldsSet(ownerId:$id,metafields:$m){
          userErrors{ field message }
        }}`,
      variables: { id: customerId, m: mf }
    }
  });

  const err = metafieldsSet.userErrors;
  if (err.length) return res.status(400).json({ ok:false, error: err });
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('API up on ' + PORT));
