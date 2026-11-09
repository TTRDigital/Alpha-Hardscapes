// Shared page behaviour: call number, slider, lightbox, lead form, conversions.
(function(){
  // Call number: /number.js swaps phone links and text for ad visitors once Alpha's number pool exists in TTR OS; until then it does nothing.
  var shown=function(){return (document.querySelector('[data-phone-text]')||{}).textContent||'us';};

  var s=document.getElementById('why-slider');
  if(s)document.querySelectorAll('.arrows button').forEach(function(b){
    b.addEventListener('click',function(){
      var card=s.querySelector('.card');
      s.scrollBy({left:(card.getBoundingClientRect().width+16)*Number(b.dataset.dir),behavior:'smooth'});
    });
  });

  var lb=document.getElementById('lightbox');
  if(lb){
    var big=lb.querySelector('img');
    document.querySelectorAll('.gallery button').forEach(function(b){
      b.addEventListener('click',function(){var i=b.querySelector('img');big.src=i.src;big.alt=i.alt;lb.classList.add('open');});
    });
    lb.addEventListener('click',function(e){if(e.target!==big)lb.classList.remove('open');});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')lb.classList.remove('open');});
  }

  var f=document.getElementById('lead-form'), ok=document.getElementById('form-ok');
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var btn=f.querySelector('button'); btn.disabled=true; btn.textContent='Sending...';
    var fd=new FormData(f); fd.append('landingUrl',location.href); fd.append('referrer',document.referrer||'');
    fetch(f.action,{method:'POST',body:fd})
      .then(function(r){ if(!r.ok) throw new Error('send failed'); return r; })
      .then(function(){
        if(window.gtag)gtag('event','conversion',{send_to:TRACK.form});
        f.style.display='none'; ok.style.display='block';
      })
      .catch(function(){
        btn.disabled=false; btn.textContent=TRACK.button;
        alert('Something went wrong. Please call us at '+shown()+'.');
      });
  });
  document.querySelectorAll('a[href^="tel:"]').forEach(function(a){
    a.addEventListener('click',function(){
      if(window.gtag)gtag('event','conversion',{send_to:TRACK.phone});
    });
  });
})();
