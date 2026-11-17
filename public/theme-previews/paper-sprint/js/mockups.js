/* ==========================================================================
   mockups.js — coded product mockups that assemble as the rail scrubs.
   Each builder returns a paused GSAP timeline; the rail sets its progress
   from scroll, so scroll is the playhead for the product itself.
   UI copy inside the mockups is illustrative.
   ========================================================================== */
(function () {
  const M = (window.Mockups = {});
  const reduce = () => window.K && K.reduce;

  /* 1 · Suggested standing orders (Pinewick Online) */
  M.routing = (host) => {
    host.innerHTML = `
      <div class="mock">
        <div class="mk-win mk-piece">
          <div class="mk-bar"><i></i><i></i><i></i><span>Accounts › Standing orders</span></div>
          <div class="mk-body">
            <div class="mk-h mk-piece"><span>Suggested standing order</span><span class="mk-badge">Built nightly</span></div>
            <div class="mk-rule mk-piece"><code><b>IF</b> product is <span class="tk">A4 copy paper</span><br><b>AND</b> 3 orders in 60 days, 8–12 reams<br><b>THEN</b> offer <span class="tk">a delivery every 3 weeks</span></code></div>
            <div class="mk-ev">
              <span class="mono mk-piece">Evidence · 3 past orders this standing order would have covered</span>
              <div class="mk-t mk-piece"><span class="mono">#48213</span><span>A4 copy paper, 10 reams</span><s>21 d gap</s></div>
              <div class="mk-t mk-piece"><span class="mono">#48377</span><span>A4 copy paper, 10 reams</span><s>22 d gap</s></div>
              <div class="mk-t mk-piece"><span class="mono">#48402</span><span>A4 copy paper, 9 reams</span><s>20 d gap</s></div>
            </div>
            <div class="mk-acts mk-piece"><span class="mk-btn">Schedule it</span><span class="mk-btn ghost">Dismiss</span><span class="mono">47% accepted</span></div>
          </div>
        </div>
      </div>`;
    const P = host.querySelectorAll('.mk-piece');
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out', duration: 1 } });
    tl.from(P[0], { y: 60, opacity: 0, scale: .94 })
      .from([P[1], P[2]], { x: -40, opacity: 0, stagger: .4 }, .4)
      .from(P[3], { opacity: 0 }, 1.2)
      .from([P[4], P[5], P[6]], { y: 24, opacity: 0, stagger: .35 }, 1.4)
      .from(P[7], { y: 20, opacity: 0 }, 2.6);
    return tl;
  };

  /* 2 · Dockslot WhatsApp chat that types itself */
  M.slotwise = (host) => {
    const msgs = [
      ['me', 'Hi, I want to collect order 4471 this week'],
      ['bot', 'Pick a day', ['Mon 14', 'Tue 15', 'Wed 16']],
      ['me', 'Tue 15'],
      ['bot', 'Open dock slots on Tue', ['8:00 am', '8:30 am', '9:00 am']],
      ['me', '8:30 am'],
      ['bot', 'Booked: Tue 15, 8:30 am at Dock B. A reminder will reach you the night before.'],
      ['bot', 'Reminder: tomorrow 8:30 am, pickup with Wendell', ['Confirm', 'Reschedule']],
    ];
    host.innerHTML = `
      <div class="mock"><div class="phone mk-piece"><div class="ph-scr">
        <div class="ph-top"><i>D</i><div><b>Dockslot · Pinewick dock</b><small>WhatsApp Business</small></div></div>
        <div class="chat">${msgs.map(([w, t, c]) => `<div class="msg ${w === 'me' ? 'me' : ''}">${t}${c ? `<div class="chips">${c.map((x) => `<span>${x}</span>`).join('')}</div>` : ''}</div>`).join('')}
          <div class="msg typing"><i></i><i></i><i></i></div></div>
      </div></div></div>`;
    const ms = host.querySelectorAll('.msg:not(.typing)');
    const typing = host.querySelector('.typing');
    const tl = gsap.timeline({ paused: true });
    tl.from(host.querySelector('.phone'), { y: 70, opacity: 0, rotation: -3, duration: 1, ease: 'power3.out' });
    gsap.set(ms, { display: 'none' });
    ms.forEach((m, i) => {
      const at = 0.8 + i * 0.55;
      tl.set(typing, { display: 'flex' }, at - .3).set(typing, { display: 'none' }, at)
        .set(m, { display: 'block' }, at)
        .from(m, { y: 14, opacity: 0, scale: .9, transformOrigin: m.classList.contains('me') ? '100% 100%' : '0 100%', duration: .3, ease: 'back.out(2)' }, at);
    });
    tl.set(typing, { display: 'none' });
    return tl;
  };

  /* 3 · Brindlewood "Tomorrow's delivery" day-before card */
  M.tomorrow = (host) => {
    host.innerHTML = `
      <div class="tmr mk-piece">
        <div class="tmr-h mk-piece"><span class="tmr-sent">Sent 5:00 pm · day before</span><span class="mk-badge">New</span></div>
        <h4 class="mk-piece">Tomorrow’s delivery</h4>
        <div class="tmr-win mk-piece"><span class="mono">Arrives</span><b>9:00 – 10:00 am</b></div>
        <div class="tmr-pro mk-piece"><span class="av" aria-hidden="true"></span><p>Your driver<small>★ 4.8 · ID checked · 600+ drops</small></p></div>
        <div class="tmr-acts mk-piece"><span>Confirm</span><span>Change time</span></div>
      </div>`;
    const P = host.querySelectorAll('.mk-piece');
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out', duration: 1 } });
    tl.from(P[0], { y: 80, opacity: 0, rotation: 4 })
      .from(P[1], { opacity: 0, y: 10 }, .5)
      .from(P[2], { opacity: 0, y: 20 }, .8)
      .from(P[3], { scaleX: 0, transformOrigin: 'left', opacity: 0 }, 1.2)
      .from(P[4], { opacity: 0, x: -30 }, 1.7)
      .from(P[4].querySelector('.av'), { scale: 0, ease: 'back.out(2)' }, 1.9)
      .from(P[5], { opacity: 0, y: 20 }, 2.3);
    return tl;
  };

  /* Device screen: the shipped surface and the layer underneath, same layout */
  M.screen = (host) => {
    const side = (under) => `<div class="app-side"><b>${under ? 'orders.yml' : 'Pinewick Online'}</b>
      <span>${under ? 'orders' : 'Orders'}</span><span>${under ? 'customers' : 'Customers'}</span><span class="on">${under ? 'standing_orders' : 'Standing orders'}</span><span>${under ? 'price_lists' : 'Price lists'}</span><span>${under ? 'reports' : 'Reports'}</span></div>`;
    host.innerHTML = `
      <div class="scr-layer scr-top">${side(false)}
        <div class="app-main">
          <div class="app-crumb">Accounts › Standing orders › Suggestions</div>
          <div class="app-h"><h4>Standing orders</h4><span class="mk-badge">3 suggestions</span></div>
          <div class="app-tbl"><div><span>Standing order</span><span>Customer</span><span>Shipped / mo</span><span>On</span></div>
            <div><span>A4 paper, 10 reams</span><span>Dental offices</span><span>212</span><span>●</span></div>
            <div><span>Toner, 4 pieces</span><span>Law firms</span><span>58</span><span>●</span></div>
            <div><span>DL envelopes, 5 boxes</span><span>Schools</span><span>131</span><span>●</span></div>
            <div><span>Sticky notes, 24 pads</span><span>Town hall</span><span>96</span><span>●</span></div>
            <div><span>Laminating pouches</span><span>Regional office</span><span>44</span><span>●</span></div></div>
          <div class="app-sugg"><span class="mono">Suggested · based on last 90 days</span>
            <p>Offer Harlan &amp; Pike Dental <b>10 reams of A4 every 3 weeks</b>. 41 rush orders for it were hand-keyed last quarter.</p>
            <div class="row"><span>Schedule it</span><span class="g">See the 3 orders</span></div></div>
        </div></div>
      <div class="scr-layer scr-under" aria-hidden="true">${side(true)}
        <div class="app-main">
          <div class="app-crumb">nightly job · 02:00 · order_history</div>
          <div class="u-code">SELECT customer_id, sku,
       count(*) AS rush_orders
FROM   order_history
WHERE  created_at &gt; now() - interval '90 days'
  AND  channel = 'phone'
GROUP  BY 1, 2
HAVING count(*) &gt;= 3   -- enough evidence
ORDER  BY rush_orders DESC;</div>
          <div class="u-note"><b>41</b> rush orders · A4 paper · every 21 days ± 2 · confidence 0.86</div>
          <div class="u-note">rule = IF 3 orders in 60 days THEN offer standing order · customer approves · no model in the loop</div>
          <div class="u-note">evidence card shows 3 past orders → acceptance 29% → 47%</div>
        </div></div>
      <div class="scr-ring" aria-hidden="true"><span>Under the screen</span></div>`;
  };
})();
