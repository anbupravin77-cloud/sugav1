/* Suga.health — shared behavior: mobile nav, scroll reveal, hero motion sequence */
(function () {
  'use strict';

  var motionOK = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (motionOK) document.documentElement.classList.add('m-on');

  // mobile nav
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        links.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // mark current page in nav
  var here = location.pathname.split('/').pop() || 'index.html';
  if (here.indexOf('.') === -1) here += '.html'; // clean URLs on the live host
  document.querySelectorAll('.nav-links a').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href === here) a.setAttribute('aria-current', 'page');
  });

  // hero load sequence: split the h1 into words, stagger everything
  var seq = document.querySelector('.seq');
  if (seq && motionOK) {
    var h1 = seq.querySelector('h1');
    if (h1 && !h1.getAttribute('data-split')) {
      var delay = 120;
      var stepMs = 65;
      var wrap = function (el) {
        var span = document.createElement('span');
        span.className = 'seq-word';
        span.style.setProperty('--d', delay + 'ms');
        delay += stepMs;
        return span;
      };
      var nodes = Array.prototype.slice.call(h1.childNodes);
      nodes.forEach(function (node) {
        if (node.nodeType === 3) { // text: split into words
          var parts = node.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var s = wrap();
            s.textContent = part;
            frag.appendChild(s);
          });
          h1.replaceChild(frag, node);
        } else if (node.nodeType === 1) { // element (e.g. the u-proof word): wrap whole
          var s2 = wrap();
          node.parentNode.insertBefore(s2, node);
          s2.appendChild(node);
        }
      });
      h1.setAttribute('data-split', '1');
      // the proof-mark starts drawing right after its word lands
      h1.style.setProperty('--proof-d', (delay + 260) + 'ms');
    }
    // chart rows fill in sequentially
    var rows = seq.querySelectorAll('.chart-row');
    Array.prototype.forEach.call(rows, function (r, i) {
      r.style.setProperty('--i', i);
    });
    seq.classList.add('is-seq');
  }

  // scroll reveal (once)
  var revealed = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealed.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -80px 0px', threshold: 0.08 });
    revealed.forEach(function (el) { io.observe(el); });
  } else {
    revealed.forEach(function (el) { el.classList.add('is-in'); });
  }
})();
