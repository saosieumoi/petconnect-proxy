import '@shopify/shopify-api/adapters/node';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pkg from '@shopify/shopify-api';
import jwt from 'jsonwebtoken';                // <-- thêm

app.post('/update-pet', verifyJWT, async (req, res) => {
  const { customerId, pets } = req.body;      // pets = {name, breed, ...}

  const gql = new shopify.clients.Graphql({ hostName: HOSTNAME, accessToken: ADMIN_TOKEN });

  /* 1) Fetch current list reference */
  const { data } = await gql.query({
    data:{ query:`query($id:ID!){
      customer(id:$id){ metafield(namespace:"pets",key:"profiles"){ value }}
    }`, variables:{ id: customerId }}
  });

  const list = JSON.parse(data.customer.metafield?.value || '[]');
  let petId   = list[0];                       // hiện chỉ làm việc với slot #1

  /* 2) Create hoặc Update metaobject */
  if (!petId) {
    const { data:{ metaobjectCreate:{ metaobject } } } = await gql.query({
      data:{ query:`mutation($def:String!,$fields:[MetaobjectFieldInput!]!){
        metaobjectCreate(handle: null, type:$def, fields:$fields){ metaobject{ id } } }`,
        variables:{
          def:"pet",
          fields:Object.entries(pets).map(([k,v])=>({ key:k, value:v?.toString() }))
        }
    });
    petId = metaobject.id;
    /* 2b) push id vào list profiles */
    list.unshift(petId);
    await gql.query({
      data:{ query:`mutation($id:ID!, $val: [ID!]!){
        metafieldsSet(metafields:[{ownerId:$id,namespace:"pets",key:"profiles",
          type:"list.metaobject_reference", value: $val }]){
          userErrors{message} } }`,
        variables:{ id:customerId, val:JSON.stringify(list) }
    });
  } else {
    /* update */
    await gql.query({
      data:{ query:`mutation($id:ID!, $fields:[MetaobjectFieldInput!]!){
        metaobjectUpdate(id:$id, fields:$fields){ userErrors{message} } }`,
        variables:{
          id:petId,
          fields:Object.entries(pets).map(([k,v])=>({ key:k, value:v?.toString() }))
        }
    });
  }

  res.json({ ok:true, petId });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('PetConnect API up on ' + PORT));
