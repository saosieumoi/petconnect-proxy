import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pkg from '@shopify/shopify-api';
import jwt from 'jsonwebtoken';                // <-- thêm

const { shopifyApi, LATEST_API_VERSION } = pkg;
const { SHOP, API_KEY, API_SECRET_KEY, ADMIN_TOKEN } = process.env;

const app = express();
app.use(cors());
app.use(express.json());

/* Shopify context */
const shopify = shopifyApi({
  apiKey: API_KEY,
  apiSecretKey: API_SECRET_KEY,
  scopes: ['write_customers'],
  isEmbeddedApp: true,
  apiVersion: LATEST_API_VERSION
});

/* Verify Customer-Account JWT */
function verifyCustomerJWT(token) {
  try {
    const payload = jwt.verify(token, API_SECRET_KEY); // HS256 signature check
    if (payload.dest && !payload.dest.includes(SHOP))
      return null;                                     // wrong shop
    return payload;                                    // contains 'sub' (customer gid)
  } catch {
    return null;
  }
}

/* POST /update-pet */
app.post('/update-pet', async (req, res) => {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer '))
    return res.status(401).json({ ok: false, error: 'Missing JWT' });

  const token   = auth.slice(7);
  const decoded = verifyCustomerJWT(token);
  if (!decoded) return res.status(401).json({ ok: false, error: 'Bad JWT' });

  const customerId = decoded.sub;
  const pets = req.body.pets || {};

  /* Build MetafieldsSetInput[] */
  const mf = Object.entries(pets).map(([k, v]) => ({
    namespace: 'pets',
    key: k,
    type:
      k === 'age_month' ? 'number_integer' :
      k === 'weight'    ? 'number_decimal' :
      'single_line_text_field',
    value: v.toString()
  }));

  /* Call Admin API */
  const client = new shopify.clients.Graphql({
    shop: SHOP,
    accessToken: ADMIN_TOKEN
  });

  const { metafieldsSet } = await client.query({
    data: {
      query: `
        mutation ($id:ID!,$m:[MetafieldsSetInput!]!){
          metafieldsSet(ownerId:$id, metafields:$m){
            userErrors{ message }
          }
        }`,
      variables: { id: customerId, m: mf }
    }
  });

  if (metafieldsSet.userErrors.length)
    return res.status(400).json({ ok:false, error: metafieldsSet.userErrors });

  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('PetConnect API up on ' + PORT));
