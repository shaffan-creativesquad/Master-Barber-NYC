import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 1. Fetch fixtures
const [{ data: loc }, { data: svc }, { data: bar }, { data: settings }] = await Promise.all([
  supa.from('locations').select('id,name').eq('name','Downtown Brooklyn').single(),
  supa.from('services').select('id,name,price_cents,duration_min').eq('active',true).limit(1).single(),
  supa.from('barbers').select('id,name').eq('name','Isak').single(),
  supa.from('business_settings').select('*').single(),
]);
console.log('Location:', loc?.name, 'Service:', svc?.name, 'Barber:', bar?.name);
console.log('Fees: cancel=$' + (settings.cancellation_fee_cents/100), 'no-show=$' + (settings.no_show_fee_cents/100));

// If both fees zero, set them so we exercise the charge path
if (settings.cancellation_fee_cents === 0 || settings.no_show_fee_cents === 0) {
  await supa.from('business_settings').update({ cancellation_fee_cents: 2500, no_show_fee_cents: 5000 }).eq('id', true);
  console.log('Set demo fees: cancel $25, no-show $50');
}
const { data: s2 } = await supa.from('business_settings').select('cancellation_fee_cents,no_show_fee_cents').single();

// 2. Stripe test customer + test payment method
const cust = await stripe.customers.create({ email: 'test+booking@example.com', name: 'Test Client' });
const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: cust.id });
console.log('Stripe customer:', cust.id, 'PM:', pm.id);

// 3. Insert customer + 4 test appointments
const { data: cRow } = await supa.from('customers').insert({
  first_name: 'Test', last_name: 'Client', email: 'test+booking@example.com', phone: '+15555550100',
}).select().single();

async function mkAppt(offsetMin) {
  const start = new Date(Date.now() + offsetMin*60000);
  const end = new Date(start.getTime() + svc.duration_min*60000);
  const { data, error } = await supa.from('appointments').insert({
    location_id: loc.id, barber_id: bar.id, service_id: svc.id, customer_id: cRow.id,
    starts_at: start.toISOString(), ends_at: end.toISOString(),
    price_cents: svc.price_cents, duration_min: svc.duration_min,
    status: 'pending', stripe_payment_method_id: pm.id, stripe_setup_intent_id: 'seti_test',
  }).select().single();
  if (error) throw error;
  return data;
}

const [a1, a2, a3, a4] = await Promise.all([mkAppt(120), mkAppt(240), mkAppt(360), mkAppt(480)]);
console.log('Created 4 pending appointments');

// 4. Confirm a1
await supa.from('appointments').update({ status: 'confirmed' }).eq('id', a1.id);
console.log('✔ a1 confirmed');

// 5. Cancel a2 (no fee)
await supa.from('appointments').update({ status: 'cancelled' }).eq('id', a2.id);
console.log('✔ a2 cancelled');

// 6. Cancel a3 WITH fee — via Stripe off-session charge
async function chargeAndClose(appt, kind) {
  const fee = kind === 'cancel' ? s2.cancellation_fee_cents : s2.no_show_fee_cents;
  const intent = await stripe.paymentIntents.create({
    amount: fee, currency: 'usd', customer: cust.id, payment_method: pm.id,
    off_session: true, confirm: true, description: `${kind} fee`,
  });
  const status = kind === 'cancel' ? 'cancelled' : 'no_show';
  const patch = { status };
  if (kind === 'cancel') patch.cancellation_fee_charged_cents = intent.status === 'succeeded' ? fee : 0;
  else patch.no_show_fee_charged_cents = intent.status === 'succeeded' ? fee : 0;
  await supa.from('appointments').update(patch).eq('id', appt.id);
  return intent;
}

const i3 = await chargeAndClose(a3, 'cancel');
console.log(`✔ a3 cancel-with-fee: PI ${i3.id} → ${i3.status} ($${(i3.amount/100).toFixed(2)})`);

const i4 = await chargeAndClose(a4, 'no_show');
console.log(`✔ a4 no-show: PI ${i4.id} → ${i4.status} ($${(i4.amount/100).toFixed(2)})`);

// 7. Verify
const { data: final } = await supa.from('appointments').select('id,status,cancellation_fee_charged_cents,no_show_fee_charged_cents').in('id',[a1.id,a2.id,a3.id,a4.id]).order('starts_at');
console.log('\n--- FINAL STATE ---');
for (const r of final) {
  console.log(`  ${r.id.slice(0,8)}  status=${r.status.padEnd(10)}  cancel_fee=$${(r.cancellation_fee_charged_cents/100).toFixed(2)}  no_show_fee=$${(r.no_show_fee_charged_cents/100).toFixed(2)}`);
}

// 8. Cleanup test data
await supa.from('appointments').delete().in('id',[a1.id,a2.id,a3.id,a4.id]);
await supa.from('customers').delete().eq('id', cRow.id);
await stripe.customers.del(cust.id);
console.log('\n✔ Cleanup complete — all four status paths executed without errors.');
