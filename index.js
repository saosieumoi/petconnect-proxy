import express from 'express';
import { Shopify } from '@shopify/shopify-api';

const app = express();
app.use(express.json());

app.post('/update', async (req, res) => {
  // TODO: xác thực HMAC header nếu cần
  const { customerId, pets } = req.body;

  const client = new Shopify.Clients.Graphql(
    process.env.SHOP,            // vd: petconnect.myshopify.com
    process.env.ADMIN_TOKEN
  );

  const meta = Object.entries(pets).map(([k, v]) => ({
    namespace: 'pets',
    key: k,
    type:
      k === 'age_month' ? 'number_integer'
      : k === 'weight'  ? 'number_decimal'
      : k === 'img_url' ? 'single_line_text_field'
      : 'single_line_text_field',
    value: v.toString()
  }));

  await client.query({
    data: {
      query: `mutation ($id:ID!,$m:[MetafieldsSetInput!]!){
        metafieldsSet(ownerId:$id,metafields:$m){userErrors{message}}}`,
      variables: { id: customerId, m: meta }
    }
  });

  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Proxy listening ' + PORT));
