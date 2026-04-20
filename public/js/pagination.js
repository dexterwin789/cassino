/*!
 * VNB Pagination — premium client-side pagination
 * Usage:
 *   var pg = VNBPagination.create({
 *     containerId: 'myPgContainer',
 *     pageSize: 10,
 *     pageSizes: [5,10,20],
 *     onChange: function(state){ renderRows(state.pageItems); }
 *   });
 *   pg.setItems(rowsArray);     // set data
 *   pg.reset();                 // back to page 1
 */
(function(){
  'use strict';

  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }

  function buildPageNumbers(cur, total){
    // Return array of numbers and '...' strings
    var out = [];
    if (total <= 7){
      for (var i=1;i<=total;i++) out.push(i);
      return out;
    }
    out.push(1);
    var start = Math.max(2, cur-1);
    var end   = Math.min(total-1, cur+1);
    if (start > 2) out.push('...');
    for (var i=start;i<=end;i++) out.push(i);
    if (end < total-1) out.push('...');
    out.push(total);
    return out;
  }

  function create(opts){
    opts = opts || {};
    var containerId = opts.containerId;
    var pageSizes = opts.pageSizes || [5,10,20];
    var state = {
      items: [],
      page: 1,
      pageSize: opts.pageSize || 10,
      pageItems: [],
      totalPages: 1,
      totalItems: 0
    };

    function compute(){
      state.totalItems = state.items.length;
      state.totalPages = Math.max(1, Math.ceil(state.totalItems / state.pageSize));
      if (state.page > state.totalPages) state.page = state.totalPages;
      if (state.page < 1) state.page = 1;
      var start = (state.page-1) * state.pageSize;
      state.pageItems = state.items.slice(start, start + state.pageSize);
      state.startIndex = state.totalItems ? start + 1 : 0;
      state.endIndex = Math.min(start + state.pageSize, state.totalItems);
    }

    function render(){
      var el = document.getElementById(containerId);
      if (!el) return;
      if (!state.totalItems){
        el.innerHTML = '';
        el.style.display = 'none';
        return;
      }
      el.style.display = '';
      var pages = buildPageNumbers(state.page, state.totalPages);
      var html = '';
      html += '<div class="vnb-pg-info">Mostrando <strong>'+state.startIndex+'</strong>–<strong>'+state.endIndex+'</strong> de <strong>'+state.totalItems+'</strong></div>';
      html += '<div class="vnb-pg-size"><label>Por página</label>';
      html += '<select class="vnb-pg-select" data-role="size">';
      pageSizes.forEach(function(n){
        html += '<option value="'+n+'"'+(n===state.pageSize?' selected':'')+'>'+n+'</option>';
      });
      html += '</select></div>';

      html += '<div class="vnb-pg-nav">';
      html += '<button class="vnb-pg-btn" data-role="prev"'+(state.page<=1?' disabled':'')+' title="Anterior" aria-label="Anterior">'
           +  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
           +  '</button>';
      pages.forEach(function(p){
        if (p === '...'){
          html += '<span class="vnb-pg-ellipsis">…</span>';
        } else {
          html += '<button class="vnb-pg-btn'+(p===state.page?' active':'')+'" data-role="page" data-page="'+p+'">'+p+'</button>';
        }
      });
      html += '<button class="vnb-pg-btn" data-role="next"'+(state.page>=state.totalPages?' disabled':'')+' title="Próxima" aria-label="Próxima">'
           +  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'
           +  '</button>';
      html += '</div>';

      el.innerHTML = html;
      el.classList.add('vnb-pg-wrap');
      wire(el);
    }

    function wire(el){
      el.querySelectorAll('[data-role="page"]').forEach(function(b){
        b.addEventListener('click', function(){ goTo(parseInt(b.getAttribute('data-page'),10)); });
      });
      var prev = el.querySelector('[data-role="prev"]');
      var next = el.querySelector('[data-role="next"]');
      if (prev) prev.addEventListener('click', function(){ goTo(state.page-1); });
      if (next) next.addEventListener('click', function(){ goTo(state.page+1); });
      var sz = el.querySelector('[data-role="size"]');
      if (sz) sz.addEventListener('change', function(){ setPageSize(parseInt(sz.value,10)); });
    }

    function emit(){
      if (typeof opts.onChange === 'function') opts.onChange(state);
    }

    function goTo(p){
      state.page = p;
      compute();
      render();
      emit();
    }
    function setPageSize(n){
      state.pageSize = n;
      state.page = 1;
      compute();
      render();
      emit();
    }
    function setItems(items){
      state.items = Array.isArray(items) ? items : [];
      state.page = 1;
      compute();
      render();
      emit();
    }
    function reset(){
      state.page = 1;
      compute();
      render();
      emit();
    }

    compute();
    return {
      setItems: setItems,
      reset: reset,
      goTo: goTo,
      setPageSize: setPageSize,
      getState: function(){ return state; }
    };
  }

  window.VNBPagination = { create: create };
})();
