// <travel-world-map> — real geometry (Natural Earth via world-atlas TopoJSON) + great-circle routes.
// Attributes (all JSON or plain strings): visited, routes, land, visitedfill, strokecolor, arc, dot, projection
(function () {
  const TOPO = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
  let topoPromise = null;

  function libsReady() {
    return new Promise((resolve) => {
      const t = setInterval(() => {
        if (window.d3 && window.topojson) { clearInterval(t); resolve(); }
      }, 50);
    });
  }

  class TravelWorldMap extends HTMLElement {
    static get observedAttributes() {
      return ['visited', 'routes', 'land', 'visitedfill', 'strokecolor', 'arc', 'dot', 'projection'];
    }
    connectedCallback() {
      if (this._built) return;
      this._built = true;
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = '<style>:host{display:block;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style><svg></svg>';
      this._svg = this.shadowRoot.querySelector('svg');
      this._ro = new ResizeObserver(() => this.draw());
      this._ro.observe(this);
      this.init();
    }
    disconnectedCallback() { if (this._ro) this._ro.disconnect(); }
    attributeChangedCallback() { if (this._features) this.draw(); }

    async init() {
      await libsReady();
      if (!topoPromise) topoPromise = window.d3.json(TOPO);
      const topo = await topoPromise;
      this._features = window.topojson.feature(topo, topo.objects.countries).features;
      this.draw();
    }

    _json(name, fallback) {
      const raw = this.getAttribute(name);
      if (!raw) return fallback;
      try { return JSON.parse(raw); } catch (e) { return fallback; }
    }

    draw() {
      if (!this._features) return;
      const d3 = window.d3;
      const w = this.clientWidth || 390, h = this.clientHeight || 300;
      if (!w || !h) return;
      const land = this.getAttribute('land') || '#eee7db';
      const visitedFill = this.getAttribute('visitedfill') || '#f6a06b';
      const stroke = this.getAttribute('strokecolor') || 'rgba(32,30,29,0.14)';
      const arcColor = this.getAttribute('arc') || '#b2622d';
      const dotColor = this.getAttribute('dot') || '#8c491a';
      const visited = new Set(this._json('visited', []));
      const routes = this._json('routes', []);

      const kind = this.getAttribute('projection') || 'naturalEarth';
      const projection = (kind === 'equal' ? d3.geoEqualEarth() : d3.geoNaturalEarth1());
      const sphere = { type: 'Sphere' };
      projection.fitExtent([[6, 6], [w - 6, h - 6]], sphere);
      const path = d3.geoPath(projection);

      const svg = d3.select(this._svg)
        .attr('viewBox', `0 0 ${w} ${h}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');
      svg.selectAll('*').remove();

      svg.append('g').selectAll('path')
        .data(this._features).join('path')
        .attr('d', path)
        .attr('fill', (d) => (visited.has(d.properties.name) ? visitedFill : land))
        .attr('stroke', stroke)
        .attr('stroke-width', 0.6);

      const arcs = svg.append('g')
        .attr('fill', 'none')
        .attr('stroke', arcColor)
        .attr('stroke-width', 1.4)
        .attr('stroke-linecap', 'round')
        .attr('opacity', 0.9);

      routes.forEach((r) => {
        const line = { type: 'LineString', coordinates: [r.from, r.to] };
        arcs.append('path').attr('d', path(line));
      });

      const dots = svg.append('g');
      const pts = new Map();
      routes.forEach((r) => { pts.set(r.from.join(), r.from); pts.set(r.to.join(), r.to); });
      pts.forEach((p) => {
        const xy = projection(p);
        if (!xy) return;
        dots.append('circle')
          .attr('cx', xy[0]).attr('cy', xy[1]).attr('r', 2.6)
          .attr('fill', dotColor)
          .attr('stroke', '#fff').attr('stroke-width', 1);
      });
    }
  }

  if (!customElements.get('travel-world-map')) customElements.define('travel-world-map', TravelWorldMap);
})();
