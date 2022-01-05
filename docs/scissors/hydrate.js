(function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    // Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
    // at the end of hydration without touching the remaining nodes.
    let is_hydrating = false;
    function start_hydrating() {
        is_hydrating = true;
    }
    function end_hydrating() {
        is_hydrating = false;
    }
    function upper_bound(low, high, key, value) {
        // Return first index of value larger than input value in the range [low, high)
        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (key(mid) <= value) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    function init_hydrate(target) {
        if (target.hydrate_init)
            return;
        target.hydrate_init = true;
        // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
        let children = target.childNodes;
        // If target is <head>, there may be children without claim_order
        if (target.nodeName === 'HEAD') {
            const myChildren = [];
            for (let i = 0; i < children.length; i++) {
                const node = children[i];
                if (node.claim_order !== undefined) {
                    myChildren.push(node);
                }
            }
            children = myChildren;
        }
        /*
        * Reorder claimed children optimally.
        * We can reorder claimed children optimally by finding the longest subsequence of
        * nodes that are already claimed in order and only moving the rest. The longest
        * subsequence subsequence of nodes that are claimed in order can be found by
        * computing the longest increasing subsequence of .claim_order values.
        *
        * This algorithm is optimal in generating the least amount of reorder operations
        * possible.
        *
        * Proof:
        * We know that, given a set of reordering operations, the nodes that do not move
        * always form an increasing subsequence, since they do not move among each other
        * meaning that they must be already ordered among each other. Thus, the maximal
        * set of nodes that do not move form a longest increasing subsequence.
        */
        // Compute longest increasing subsequence
        // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
        const m = new Int32Array(children.length + 1);
        // Predecessor indices + 1
        const p = new Int32Array(children.length);
        m[0] = -1;
        let longest = 0;
        for (let i = 0; i < children.length; i++) {
            const current = children[i].claim_order;
            // Find the largest subsequence length such that it ends in a value less than our current value
            // upper_bound returns first greater value, so we subtract one
            // with fast path for when we are on the current longest subsequence
            const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
            p[i] = m[seqLen] + 1;
            const newLen = seqLen + 1;
            // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
            m[newLen] = i;
            longest = Math.max(newLen, longest);
        }
        // The longest increasing subsequence of nodes (initially reversed)
        const lis = [];
        // The rest of the nodes, nodes that will be moved
        const toMove = [];
        let last = children.length - 1;
        for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
            lis.push(children[cur - 1]);
            for (; last >= cur; last--) {
                toMove.push(children[last]);
            }
            last--;
        }
        for (; last >= 0; last--) {
            toMove.push(children[last]);
        }
        lis.reverse();
        // We sort the nodes being moved to guarantee that their insertion order matches the claim order
        toMove.sort((a, b) => a.claim_order - b.claim_order);
        // Finally, we move the nodes
        for (let i = 0, j = 0; i < toMove.length; i++) {
            while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
                j++;
            }
            const anchor = j < lis.length ? lis[j] : null;
            target.insertBefore(toMove[i], anchor);
        }
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function append_styles(target, style_sheet_id, styles) {
        const append_styles_to = get_root_for_style(target);
        if (!append_styles_to.getElementById(style_sheet_id)) {
            const style = element('style');
            style.id = style_sheet_id;
            style.textContent = styles;
            append_stylesheet(append_styles_to, style);
        }
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
    }
    function append_hydration(target, node) {
        if (is_hydrating) {
            init_hydrate(target);
            if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentElement !== target))) {
                target.actual_end_child = target.firstChild;
            }
            // Skip nodes of undefined ordering
            while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
                target.actual_end_child = target.actual_end_child.nextSibling;
            }
            if (node !== target.actual_end_child) {
                // We only insert if the ordering of this node should be modified or the parent node is not target
                if (node.claim_order !== undefined || node.parentNode !== target) {
                    target.insertBefore(node, target.actual_end_child);
                }
            }
            else {
                target.actual_end_child = node.nextSibling;
            }
        }
        else if (node.parentNode !== target || node.nextSibling !== null) {
            target.appendChild(node);
        }
    }
    function insert_hydration(target, node, anchor) {
        if (is_hydrating && !anchor) {
            append_hydration(target, node);
        }
        else if (node.parentNode !== target || node.nextSibling != anchor) {
            target.insertBefore(node, anchor || null);
        }
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function init_claim_info(nodes) {
        if (nodes.claim_info === undefined) {
            nodes.claim_info = { last_index: 0, total_claimed: 0 };
        }
    }
    function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
        // Try to find nodes in an order such that we lengthen the longest increasing subsequence
        init_claim_info(nodes);
        const resultNode = (() => {
            // We first try to find an element after the previous one
            for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
                const node = nodes[i];
                if (predicate(node)) {
                    const replacement = processNode(node);
                    if (replacement === undefined) {
                        nodes.splice(i, 1);
                    }
                    else {
                        nodes[i] = replacement;
                    }
                    if (!dontUpdateLastIndex) {
                        nodes.claim_info.last_index = i;
                    }
                    return node;
                }
            }
            // Otherwise, we try to find one before
            // We iterate in reverse so that we don't go too far back
            for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
                const node = nodes[i];
                if (predicate(node)) {
                    const replacement = processNode(node);
                    if (replacement === undefined) {
                        nodes.splice(i, 1);
                    }
                    else {
                        nodes[i] = replacement;
                    }
                    if (!dontUpdateLastIndex) {
                        nodes.claim_info.last_index = i;
                    }
                    else if (replacement === undefined) {
                        // Since we spliced before the last_index, we decrease it
                        nodes.claim_info.last_index--;
                    }
                    return node;
                }
            }
            // If we can't find any matching node, we create a new one
            return createNode();
        })();
        resultNode.claim_order = nodes.claim_info.total_claimed;
        nodes.claim_info.total_claimed += 1;
        return resultNode;
    }
    function claim_element_base(nodes, name, attributes, create_element) {
        return claim_node(nodes, (node) => node.nodeName === name, (node) => {
            const remove = [];
            for (let j = 0; j < node.attributes.length; j++) {
                const attribute = node.attributes[j];
                if (!attributes[attribute.name]) {
                    remove.push(attribute.name);
                }
            }
            remove.forEach(v => node.removeAttribute(v));
            return undefined;
        }, () => create_element(name));
    }
    function claim_element(nodes, name, attributes) {
        return claim_element_base(nodes, name, attributes, element);
    }
    function claim_text(nodes, data) {
        return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
            const dataStr = '' + data;
            if (node.data.startsWith(dataStr)) {
                if (node.data.length !== dataStr.length) {
                    return node.splitText(dataStr.length);
                }
            }
            else {
                node.data = dataStr;
            }
        }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
        );
    }
    function claim_space(nodes) {
        return claim_text(nodes, ' ');
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function claim_component(block, parent_nodes) {
        block && block.l(parent_nodes);
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                start_hydrating();
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            end_hydrating();
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.44.3' }, detail), true));
    }
    function append_hydration_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append_hydration(target, node);
    }
    function insert_hydration_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert_hydration(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* table/Arrows.svelte generated by Svelte v3.44.3 */

    const file$1 = "table/Arrows.svelte";

    function add_css$1(target) {
    	append_styles(target, "svelte-v37n4u", ".container.svelte-v37n4u.svelte-v37n4u{font-size:12px;display:flex;flex-direction:column;justify-content:center;gap:5%;height:100%;color:#e4e4e4}[data-sort-direction='1'].svelte-v37n4u .down.svelte-v37n4u{color:var(--accent-color)}[data-sort-direction='-1'].svelte-v37n4u .up.svelte-v37n4u{color:var(--accent-color)}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXJyb3dzLnN2ZWx0ZSIsInNvdXJjZXMiOlsiQXJyb3dzLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxuXHRleHBvcnQgbGV0IGRpcmVjdGlvbiA9IG51bGxcbjwvc2NyaXB0PlxuXG48c3BhbiBjbGFzcz1jb250YWluZXIgZGF0YS1zb3J0LWRpcmVjdGlvbj17ZGlyZWN0aW9ufSBvbjpjbGljaz5cblx0PHNwYW4gY2xhc3M9dXA+XG5cdFx04payXG5cdDwvc3Bhbj5cblx0PHNwYW4gY2xhc3M9ZG93bj5cblx0XHTilrxcblx0PC9zcGFuPlxuPC9zcGFuPlxuXG48c3R5bGU+XG5cdC5jb250YWluZXIge1xuXHRcdGZvbnQtc2l6ZTogMTJweDtcblx0XHRkaXNwbGF5OiBmbGV4O1xuXHRcdGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG5cdFx0anVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG5cdFx0Z2FwOiA1JTsgLyogSSdsbCByZWdyZXQgdGhpcywgcmlnaHQ/ICovXG5cdFx0aGVpZ2h0OiAxMDAlO1xuXHRcdGNvbG9yOiAjZTRlNGU0O1xuXHR9XG5cdFtkYXRhLXNvcnQtZGlyZWN0aW9uPScxJ10gLmRvd24ge1xuXHRcdGNvbG9yOiB2YXIoLS1hY2NlbnQtY29sb3IpO1xuXHR9XG5cdFtkYXRhLXNvcnQtZGlyZWN0aW9uPSctMSddIC51cCB7XG5cdFx0Y29sb3I6IHZhcigtLWFjY2VudC1jb2xvcik7XG5cdH1cblxuPC9zdHlsZT5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFjQyxVQUFVLDRCQUFDLENBQUMsQUFDWCxTQUFTLENBQUUsSUFBSSxDQUNmLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLE1BQU0sQ0FDdEIsZUFBZSxDQUFFLE1BQU0sQ0FDdkIsR0FBRyxDQUFFLEVBQUUsQ0FDUCxNQUFNLENBQUUsSUFBSSxDQUNaLEtBQUssQ0FBRSxPQUFPLEFBQ2YsQ0FBQyxBQUNELENBQUMsbUJBQW1CLENBQUMsR0FBRyxlQUFDLENBQUMsS0FBSyxjQUFDLENBQUMsQUFDaEMsS0FBSyxDQUFFLElBQUksY0FBYyxDQUFDLEFBQzNCLENBQUMsQUFDRCxDQUFDLG1CQUFtQixDQUFDLElBQUksZUFBQyxDQUFDLEdBQUcsY0FBQyxDQUFDLEFBQy9CLEtBQUssQ0FBRSxJQUFJLGNBQWMsQ0FBQyxBQUMzQixDQUFDIn0= */");
    }

    function create_fragment$1(ctx) {
    	let span2;
    	let span0;
    	let t0;
    	let t1;
    	let span1;
    	let t2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			span2 = element("span");
    			span0 = element("span");
    			t0 = text("▲");
    			t1 = space();
    			span1 = element("span");
    			t2 = text("▼");
    			this.h();
    		},
    		l: function claim(nodes) {
    			span2 = claim_element(nodes, "SPAN", { class: true, "data-sort-direction": true });
    			var span2_nodes = children(span2);
    			span0 = claim_element(span2_nodes, "SPAN", { class: true });
    			var span0_nodes = children(span0);
    			t0 = claim_text(span0_nodes, "▲");
    			span0_nodes.forEach(detach_dev);
    			t1 = claim_space(span2_nodes);
    			span1 = claim_element(span2_nodes, "SPAN", { class: true });
    			var span1_nodes = children(span1);
    			t2 = claim_text(span1_nodes, "▼");
    			span1_nodes.forEach(detach_dev);
    			span2_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span0, "class", "up svelte-v37n4u");
    			add_location(span0, file$1, 5, 1, 114);
    			attr_dev(span1, "class", "down svelte-v37n4u");
    			add_location(span1, file$1, 8, 1, 144);
    			attr_dev(span2, "class", "container svelte-v37n4u");
    			attr_dev(span2, "data-sort-direction", /*direction*/ ctx[0]);
    			add_location(span2, file$1, 4, 0, 49);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, span2, anchor);
    			append_hydration_dev(span2, span0);
    			append_hydration_dev(span0, t0);
    			append_hydration_dev(span2, t1);
    			append_hydration_dev(span2, span1);
    			append_hydration_dev(span1, t2);

    			if (!mounted) {
    				dispose = listen_dev(span2, "click", /*click_handler*/ ctx[1], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*direction*/ 1) {
    				attr_dev(span2, "data-sort-direction", /*direction*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span2);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Arrows', slots, []);
    	let { direction = null } = $$props;
    	const writable_props = ['direction'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Arrows> was created with unknown prop '${key}'`);
    	});

    	function click_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('direction' in $$props) $$invalidate(0, direction = $$props.direction);
    	};

    	$$self.$capture_state = () => ({ direction });

    	$$self.$inject_state = $$props => {
    		if ('direction' in $$props) $$invalidate(0, direction = $$props.direction);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [direction, click_handler];
    }

    class Arrows extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { direction: 0 }, add_css$1);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Arrows",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get direction() {
    		throw new Error("<Arrows>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set direction(value) {
    		throw new Error("<Arrows>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* table/Table.svelte generated by Svelte v3.44.3 */
    const file = "table/Table.svelte";

    function add_css(target) {
    	append_styles(target, "svelte-17in6y7", "table.svelte-17in6y7.svelte-17in6y7{border-collapse:collapse;--accent-color:rgb(220, 53, 41);--background-accent-color:rgba(254, 251, 251)}th.svelte-17in6y7.svelte-17in6y7{text-align:left;padding:8px;vertical-align:bottom;cursor:pointer;padding-right:22px\n\t}th.svelte-17in6y7.svelte-17in6y7,td.svelte-17in6y7.svelte-17in6y7{border:1px solid gray}th[data-type=number].svelte-17in6y7.svelte-17in6y7,td[data-type=number].svelte-17in6y7.svelte-17in6y7{text-align:right}td.svelte-17in6y7.svelte-17in6y7{padding:4px 8px}td[data-type=number].svelte-17in6y7.svelte-17in6y7{font-variant-numeric:tabular-nums}tbody.svelte-17in6y7 tr.svelte-17in6y7:nth-child(2n){background-color:var(--background-accent-color)}th.svelte-17in6y7.svelte-17in6y7{position:relative}.arrows.svelte-17in6y7.svelte-17in6y7{position:absolute;right:2px;top:0;height:100%}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGFibGUuc3ZlbHRlIiwic291cmNlcyI6WyJUYWJsZS5zdmVsdGUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdD5cblx0aW1wb3J0IEFycm93cyBmcm9tICcuL0Fycm93cy5zdmVsdGUnXG5cdGV4cG9ydCBsZXQgY29sdW1uc1xuXHRleHBvcnQgbGV0IHZhbHVlc1xuXHRleHBvcnQgbGV0IGlkZW50aWZpZXJcblx0ZXhwb3J0IGxldCBpbml0aWFsX3NvcnRfY29sdW1uID0gMFxuXHRleHBvcnQgbGV0IGxpbmtzX2FyZV9leHRlcm5hbCA9IHRydWVcblx0XG5cdGNvbnN0IHNvcnRfZGlyZWN0aW9ucyA9IHtcblx0XHRhc2M6IDEsXG5cdFx0ZGVzYzogLTEsXG5cdH1cblxuXHRjb25zdCBnZXRfYWN0dWFsX3ZhbHVlID0gcm93X2VsZW1lbnQgPT4gdHlwZW9mIHJvd19lbGVtZW50ID09PSBgb2JqZWN0YFxuXHRcdD8gcm93X2VsZW1lbnQudGV4dFxuXHRcdDogcm93X2VsZW1lbnRcblxuXHRjb25zdCBkaXNwbGF5X2NvbHVtbiA9IChjb2x1bW4sIHZhbHVlKSA9PiB7XG5cdFx0Y29uc3QgaXNfbnVtYmVyID0gdHlwZW9mIGNvbHVtbiA9PT0gYG9iamVjdGAgJiYgY29sdW1uLnR5cGUgPT09IGBudW1iZXJgICYmIGBmaXhlZGAgaW4gY29sdW1uXG5cdFx0Y29uc3QgYWN0dWFsX3ZhbHVlID0gZ2V0X2FjdHVhbF92YWx1ZSh2YWx1ZSlcblxuXHRcdGlmIChpc19udW1iZXIpIHtcblx0XHRcdHJldHVybiBhY3R1YWxfdmFsdWUudG9GaXhlZChjb2x1bW4uZml4ZWQpXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFjdHVhbF92YWx1ZVxuXHR9XG5cblx0bGV0IHNvcnQgPSBudWxsXG5cblx0Y29uc3QgYXBwbHlfc29ydCA9IGNvbHVtbl9pbmRleCA9PiB7XG5cdFx0Y29uc3QgbmV4dF9zb3J0X2RpcmVjdGlvbiA9IHNvcnQ/LmNvbHVtbl9pbmRleCA9PT0gY29sdW1uX2luZGV4ICYmIHNvcnQuZGlyZWN0aW9uID09PSBzb3J0X2RpcmVjdGlvbnMuZGVzY1xuXHRcdFx0PyBzb3J0X2RpcmVjdGlvbnMuYXNjXG5cdFx0XHQ6IHNvcnRfZGlyZWN0aW9ucy5kZXNjXG5cblx0XHRzb3J0ID0ge1xuXHRcdFx0Y29sdW1uX2luZGV4LFxuXHRcdFx0ZGlyZWN0aW9uOiBuZXh0X3NvcnRfZGlyZWN0aW9uLFxuXHRcdH1cblx0fVxuXG5cdCQ6IGFwcGx5X3NvcnQoaW5pdGlhbF9zb3J0X2NvbHVtbilcblxuXHQkOiBzb3J0ZWRfcm93cyA9IHZhbHVlcy5zbGljZSgpLnNvcnQoXG5cdFx0KHJvd19hLCByb3dfYikgPT4ge1xuXHRcdFx0Y29uc3QgdmFsdWVfYSA9IGdldF9hY3R1YWxfdmFsdWUocm93X2Fbc29ydC5jb2x1bW5faW5kZXhdKVxuXHRcdFx0Y29uc3QgdmFsdWVfYiA9IGdldF9hY3R1YWxfdmFsdWUocm93X2Jbc29ydC5jb2x1bW5faW5kZXhdKVxuXG5cdFx0XHRpZiAodmFsdWVfYSA9PT0gdmFsdWVfYikge1xuXHRcdFx0XHRyZXR1cm4gMFxuXHRcdFx0fSBlbHNlIGlmICh2YWx1ZV9hIDwgdmFsdWVfYikge1xuXHRcdFx0XHRyZXR1cm4gc29ydC5kaXJlY3Rpb25cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiAtc29ydC5kaXJlY3Rpb25cblx0XHRcdH1cblx0XHR9LFxuXHQpXG5cblx0Y29uc3QgcHJldmVudF9kZWZhdWx0X29uX211bHRpcGxlX2NsaWNrcyA9IGV2ZW50ID0+IHtcblx0XHRjb25zdCBjbGlja19jb3VudCA9IGV2ZW50LmRldGFpbFxuXHRcdGlmIChjbGlja19jb3VudCA+IDEpIHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KClcblx0XHR9XG5cdH1cbjwvc2NyaXB0PlxuXG48dGFibGUgZGF0YS10YWJsZS1pZGVudGlmaWVyPXtpZGVudGlmaWVyfT5cblx0PHRoZWFkPlxuXHRcdDx0cj5cblx0XHRcdHsjZWFjaCBjb2x1bW5zIGFzIGNvbHVtbiwgY29sdW1uX2luZGV4fVxuXHRcdFx0XHQ8dGhcblx0XHRcdFx0XHRkYXRhLXR5cGU9e2NvbHVtbi50eXBlIHx8IGBzdHJpbmdgfVxuXHRcdFx0XHRcdG9uOm1vdXNlZG93bj17cHJldmVudF9kZWZhdWx0X29uX211bHRpcGxlX2NsaWNrc31cblx0XHRcdFx0XHRvbjpjbGlja3xwcmV2ZW50RGVmYXVsdD17KCkgPT4gYXBwbHlfc29ydChjb2x1bW5faW5kZXgpfVxuXHRcdFx0XHQ+XG5cdFx0XHRcdFx0e2NvbHVtbi5uYW1lfVxuXHRcdFx0XHRcdDxzcGFuIGNsYXNzPWFycm93cz5cblx0XHRcdFx0XHRcdDxBcnJvd3MgZGlyZWN0aW9uPXtzb3J0LmNvbHVtbl9pbmRleCA9PT0gY29sdW1uX2luZGV4ID8gc29ydC5kaXJlY3Rpb24gOiBudWxsfSAvPlxuXHRcdFx0XHRcdDwvc3Bhbj5cblx0XHRcdFx0PC90aD5cblx0XHRcdHsvZWFjaH1cblx0XHQ8L3RyPlxuXHQ8L3RoZWFkPlxuXHQ8dGJvZHk+XG5cdFx0eyNlYWNoIHNvcnRlZF9yb3dzIGFzIHJvd31cblx0XHRcdDx0cj5cblx0XHRcdFx0eyNlYWNoIGNvbHVtbnMgYXMgY29sdW1uLCBpbmRleH1cblx0XHRcdFx0XHQ8dGQgZGF0YS10eXBlPXtjb2x1bW4udHlwZX0+XG5cdFx0XHRcdFx0XHR7I2lmIHR5cGVvZiByb3dbaW5kZXhdID09PSBgb2JqZWN0YH1cblx0XHRcdFx0XHRcdFx0PGFcblx0XHRcdFx0XHRcdFx0XHRocmVmPXtyb3dbaW5kZXhdLmxpbmt9XG5cdFx0XHRcdFx0XHRcdFx0dGFyZ2V0PXtsaW5rc19hcmVfZXh0ZXJuYWwgPyBgX2JsYW5rYCA6IGBfc2VsZmB9XG5cdFx0XHRcdFx0XHRcdFx0cmVsPXtsaW5rc19hcmVfZXh0ZXJuYWwgPyBgZXh0ZXJuYWwgbm9mb2xsb3cgbm9vcGVuZXJgIDogYGB9XG5cdFx0XHRcdFx0XHRcdD5cblx0XHRcdFx0XHRcdFx0XHR7ZGlzcGxheV9jb2x1bW4oY29sdW1uLCByb3dbaW5kZXhdKX1cblx0XHRcdFx0XHRcdFx0PC9hPlxuXHRcdFx0XHRcdFx0ezplbHNlfVxuXHRcdFx0XHRcdFx0XHR7ZGlzcGxheV9jb2x1bW4oY29sdW1uLCByb3dbaW5kZXhdKX1cblx0XHRcdFx0XHRcdHsvaWZ9XG5cdFx0XHRcdFx0PC90ZD5cblx0XHRcdFx0ey9lYWNofVxuXHRcdFx0PC90cj5cblx0XHR7L2VhY2h9XG5cdDwvdGJvZHk+XG48L3RhYmxlPlxuXG48c3R5bGU+XG5cdHRhYmxlIHtcblx0XHRib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlO1xuXHRcdC0tYWNjZW50LWNvbG9yOiByZ2IoMjIwLCA1MywgNDEpO1xuXHRcdC0tYmFja2dyb3VuZC1hY2NlbnQtY29sb3I6IHJnYmEoMjU0LCAyNTEsIDI1MSk7XG5cdH1cblx0dGgge1xuXHRcdHRleHQtYWxpZ246IGxlZnQ7XG5cblx0XHRwYWRkaW5nOiA4cHg7XG5cdFx0dmVydGljYWwtYWxpZ246IGJvdHRvbTtcblx0XHRjdXJzb3I6IHBvaW50ZXI7XG5cdFx0cGFkZGluZy1yaWdodDogMjJweFxuXHR9XG5cdHRoLCB0ZCB7XG5cdFx0Ym9yZGVyOiAxcHggc29saWQgZ3JheTtcblx0fVxuXHR0aFtkYXRhLXR5cGU9bnVtYmVyXSwgdGRbZGF0YS10eXBlPW51bWJlcl0ge1xuXHRcdHRleHQtYWxpZ246IHJpZ2h0O1xuXHR9XG5cdHRkIHtcblx0XHRwYWRkaW5nOiA0cHggOHB4O1xuXHR9XG5cdHRkW2RhdGEtdHlwZT1udW1iZXJdIHtcblx0XHRmb250LXZhcmlhbnQtbnVtZXJpYzogdGFidWxhci1udW1zO1xuXHR9XG5cdHRib2R5IHRyOm50aC1jaGlsZCgybikge1xuXHRcdGJhY2tncm91bmQtY29sb3I6IHZhcigtLWJhY2tncm91bmQtYWNjZW50LWNvbG9yKTtcblx0fVxuXHRcblx0dGgge1xuXHRcdHBvc2l0aW9uOiByZWxhdGl2ZTtcblx0fVxuXHQuYXJyb3dzIHtcblx0XHRwb3NpdGlvbjogYWJzb2x1dGU7XG5cdFx0cmlnaHQ6IDJweDtcblx0XHR0b3A6IDA7XG5cdFx0aGVpZ2h0OiAxMDAlO1xuXHR9XG48L3N0eWxlPlxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQTJHQyxLQUFLLDhCQUFDLENBQUMsQUFDTixlQUFlLENBQUUsUUFBUSxDQUN6QixjQUFjLENBQUUsZ0JBQWdCLENBQ2hDLHlCQUF5QixDQUFFLG1CQUFtQixBQUMvQyxDQUFDLEFBQ0QsRUFBRSw4QkFBQyxDQUFDLEFBQ0gsVUFBVSxDQUFFLElBQUksQ0FFaEIsT0FBTyxDQUFFLEdBQUcsQ0FDWixjQUFjLENBQUUsTUFBTSxDQUN0QixNQUFNLENBQUUsT0FBTyxDQUNmLGFBQWEsQ0FBRSxJQUFJO0NBQ3BCLENBQUMsQUFDRCxnQ0FBRSxDQUFFLEVBQUUsOEJBQUMsQ0FBQyxBQUNQLE1BQU0sQ0FBRSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQUFDdkIsQ0FBQyxBQUNELEVBQUUsQ0FBQyxTQUFTLENBQUMsTUFBTSwrQkFBQyxDQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLDhCQUFDLENBQUMsQUFDM0MsVUFBVSxDQUFFLEtBQUssQUFDbEIsQ0FBQyxBQUNELEVBQUUsOEJBQUMsQ0FBQyxBQUNILE9BQU8sQ0FBRSxHQUFHLENBQUMsR0FBRyxBQUNqQixDQUFDLEFBQ0QsRUFBRSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsOEJBQUMsQ0FBQyxBQUNyQixvQkFBb0IsQ0FBRSxZQUFZLEFBQ25DLENBQUMsQUFDRCxvQkFBSyxDQUFDLGlCQUFFLFdBQVcsRUFBRSxDQUFDLEFBQUMsQ0FBQyxBQUN2QixnQkFBZ0IsQ0FBRSxJQUFJLHlCQUF5QixDQUFDLEFBQ2pELENBQUMsQUFFRCxFQUFFLDhCQUFDLENBQUMsQUFDSCxRQUFRLENBQUUsUUFBUSxBQUNuQixDQUFDLEFBQ0QsT0FBTyw4QkFBQyxDQUFDLEFBQ1IsUUFBUSxDQUFFLFFBQVEsQ0FDbEIsS0FBSyxDQUFFLEdBQUcsQ0FDVixHQUFHLENBQUUsQ0FBQyxDQUNOLE1BQU0sQ0FBRSxJQUFJLEFBQ2IsQ0FBQyJ9 */");
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[16] = list[i];
    	child_ctx[18] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[16] = list[i];
    	child_ctx[20] = i;
    	return child_ctx;
    }

    // (70:3) {#each columns as column, column_index}
    function create_each_block_2(ctx) {
    	let th;
    	let t0_value = /*column*/ ctx[16].name + "";
    	let t0;
    	let t1;
    	let span;
    	let arrows;
    	let t2;
    	let th_data_type_value;
    	let current;
    	let mounted;
    	let dispose;

    	arrows = new Arrows({
    			props: {
    				direction: /*sort*/ ctx[3].column_index === /*column_index*/ ctx[20]
    				? /*sort*/ ctx[3].direction
    				: null
    			},
    			$$inline: true
    		});

    	function click_handler() {
    		return /*click_handler*/ ctx[10](/*column_index*/ ctx[20]);
    	}

    	const block = {
    		c: function create() {
    			th = element("th");
    			t0 = text(t0_value);
    			t1 = space();
    			span = element("span");
    			create_component(arrows.$$.fragment);
    			t2 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			th = claim_element(nodes, "TH", { "data-type": true, class: true });
    			var th_nodes = children(th);
    			t0 = claim_text(th_nodes, t0_value);
    			t1 = claim_space(th_nodes);
    			span = claim_element(th_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			claim_component(arrows.$$.fragment, span_nodes);
    			span_nodes.forEach(detach_dev);
    			t2 = claim_space(th_nodes);
    			th_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "arrows svelte-17in6y7");
    			add_location(span, file, 76, 5, 1758);
    			attr_dev(th, "data-type", th_data_type_value = /*column*/ ctx[16].type || `string`);
    			attr_dev(th, "class", "svelte-17in6y7");
    			add_location(th, file, 70, 4, 1566);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, th, anchor);
    			append_hydration_dev(th, t0);
    			append_hydration_dev(th, t1);
    			append_hydration_dev(th, span);
    			mount_component(arrows, span, null);
    			append_hydration_dev(th, t2);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(th, "mousedown", /*prevent_default_on_multiple_clicks*/ ctx[7], false, false, false),
    					listen_dev(th, "click", prevent_default(click_handler), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if ((!current || dirty & /*columns*/ 1) && t0_value !== (t0_value = /*column*/ ctx[16].name + "")) set_data_dev(t0, t0_value);
    			const arrows_changes = {};

    			if (dirty & /*sort*/ 8) arrows_changes.direction = /*sort*/ ctx[3].column_index === /*column_index*/ ctx[20]
    			? /*sort*/ ctx[3].direction
    			: null;

    			arrows.$set(arrows_changes);

    			if (!current || dirty & /*columns*/ 1 && th_data_type_value !== (th_data_type_value = /*column*/ ctx[16].type || `string`)) {
    				attr_dev(th, "data-type", th_data_type_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(arrows.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(arrows.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(th);
    			destroy_component(arrows);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(70:3) {#each columns as column, column_index}",
    		ctx
    	});

    	return block;
    }

    // (97:6) {:else}
    function create_else_block(ctx) {
    	let t_value = /*display_column*/ ctx[5](/*column*/ ctx[16], /*row*/ ctx[13][/*index*/ ctx[18]]) + "";
    	let t;

    	const block = {
    		c: function create() {
    			t = text(t_value);
    		},
    		l: function claim(nodes) {
    			t = claim_text(nodes, t_value);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, t, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*columns, sorted_rows*/ 17 && t_value !== (t_value = /*display_column*/ ctx[5](/*column*/ ctx[16], /*row*/ ctx[13][/*index*/ ctx[18]]) + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(97:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (89:6) {#if typeof row[index] === `object`}
    function create_if_block(ctx) {
    	let a;
    	let t_value = /*display_column*/ ctx[5](/*column*/ ctx[16], /*row*/ ctx[13][/*index*/ ctx[18]]) + "";
    	let t;
    	let a_href_value;
    	let a_target_value;
    	let a_rel_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			t = text(t_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			a = claim_element(nodes, "A", { href: true, target: true, rel: true });
    			var a_nodes = children(a);
    			t = claim_text(a_nodes, t_value);
    			a_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a, "href", a_href_value = /*row*/ ctx[13][/*index*/ ctx[18]].link);
    			attr_dev(a, "target", a_target_value = /*links_are_external*/ ctx[2] ? `_blank` : `_self`);

    			attr_dev(a, "rel", a_rel_value = /*links_are_external*/ ctx[2]
    			? `external nofollow noopener`
    			: ``);

    			add_location(a, file, 89, 7, 2085);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);
    			append_hydration_dev(a, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*columns, sorted_rows*/ 17 && t_value !== (t_value = /*display_column*/ ctx[5](/*column*/ ctx[16], /*row*/ ctx[13][/*index*/ ctx[18]]) + "")) set_data_dev(t, t_value);

    			if (dirty & /*sorted_rows*/ 16 && a_href_value !== (a_href_value = /*row*/ ctx[13][/*index*/ ctx[18]].link)) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if (dirty & /*links_are_external*/ 4 && a_target_value !== (a_target_value = /*links_are_external*/ ctx[2] ? `_blank` : `_self`)) {
    				attr_dev(a, "target", a_target_value);
    			}

    			if (dirty & /*links_are_external*/ 4 && a_rel_value !== (a_rel_value = /*links_are_external*/ ctx[2]
    			? `external nofollow noopener`
    			: ``)) {
    				attr_dev(a, "rel", a_rel_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(89:6) {#if typeof row[index] === `object`}",
    		ctx
    	});

    	return block;
    }

    // (87:4) {#each columns as column, index}
    function create_each_block_1(ctx) {
    	let td;
    	let td_data_type_value;

    	function select_block_type(ctx, dirty) {
    		if (typeof /*row*/ ctx[13][/*index*/ ctx[18]] === `object`) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			td = element("td");
    			if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			td = claim_element(nodes, "TD", { "data-type": true, class: true });
    			var td_nodes = children(td);
    			if_block.l(td_nodes);
    			td_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(td, "data-type", td_data_type_value = /*column*/ ctx[16].type);
    			attr_dev(td, "class", "svelte-17in6y7");
    			add_location(td, file, 87, 5, 2006);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, td, anchor);
    			if_block.m(td, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(td, null);
    				}
    			}

    			if (dirty & /*columns*/ 1 && td_data_type_value !== (td_data_type_value = /*column*/ ctx[16].type)) {
    				attr_dev(td, "data-type", td_data_type_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(td);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(87:4) {#each columns as column, index}",
    		ctx
    	});

    	return block;
    }

    // (85:2) {#each sorted_rows as row}
    function create_each_block(ctx) {
    	let tr;
    	let t;
    	let each_value_1 = /*columns*/ ctx[0];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			tr = element("tr");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			tr = claim_element(nodes, "TR", { class: true });
    			var tr_nodes = children(tr);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(tr_nodes);
    			}

    			t = claim_space(tr_nodes);
    			tr_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(tr, "class", "svelte-17in6y7");
    			add_location(tr, file, 85, 3, 1959);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, tr, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tr, null);
    			}

    			append_hydration_dev(tr, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*columns, sorted_rows, links_are_external, display_column*/ 53) {
    				each_value_1 = /*columns*/ ctx[0];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(tr, t);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(85:2) {#each sorted_rows as row}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let table;
    	let thead;
    	let tr;
    	let t;
    	let tbody;
    	let current;
    	let each_value_2 = /*columns*/ ctx[0];
    	validate_each_argument(each_value_2);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	const out = i => transition_out(each_blocks_1[i], 1, 1, () => {
    		each_blocks_1[i] = null;
    	});

    	let each_value = /*sorted_rows*/ ctx[4];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			table = element("table");
    			thead = element("thead");
    			tr = element("tr");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t = space();
    			tbody = element("tbody");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			table = claim_element(nodes, "TABLE", {
    				"data-table-identifier": true,
    				class: true
    			});

    			var table_nodes = children(table);
    			thead = claim_element(table_nodes, "THEAD", {});
    			var thead_nodes = children(thead);
    			tr = claim_element(thead_nodes, "TR", {});
    			var tr_nodes = children(tr);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].l(tr_nodes);
    			}

    			tr_nodes.forEach(detach_dev);
    			thead_nodes.forEach(detach_dev);
    			t = claim_space(table_nodes);
    			tbody = claim_element(table_nodes, "TBODY", { class: true });
    			var tbody_nodes = children(tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(tbody_nodes);
    			}

    			tbody_nodes.forEach(detach_dev);
    			table_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(tr, file, 68, 2, 1514);
    			add_location(thead, file, 67, 1, 1504);
    			attr_dev(tbody, "class", "svelte-17in6y7");
    			add_location(tbody, file, 83, 1, 1919);
    			attr_dev(table, "data-table-identifier", /*identifier*/ ctx[1]);
    			attr_dev(table, "class", "svelte-17in6y7");
    			add_location(table, file, 66, 0, 1460);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, table, anchor);
    			append_hydration_dev(table, thead);
    			append_hydration_dev(thead, tr);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(tr, null);
    			}

    			append_hydration_dev(table, t);
    			append_hydration_dev(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tbody, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*columns, prevent_default_on_multiple_clicks, apply_sort, sort*/ 201) {
    				each_value_2 = /*columns*/ ctx[0];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    						transition_in(each_blocks_1[i], 1);
    					} else {
    						each_blocks_1[i] = create_each_block_2(child_ctx);
    						each_blocks_1[i].c();
    						transition_in(each_blocks_1[i], 1);
    						each_blocks_1[i].m(tr, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_2.length; i < each_blocks_1.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (dirty & /*columns, sorted_rows, links_are_external, display_column*/ 53) {
    				each_value = /*sorted_rows*/ ctx[4];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(tbody, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (!current || dirty & /*identifier*/ 2) {
    				attr_dev(table, "data-table-identifier", /*identifier*/ ctx[1]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_2.length; i += 1) {
    				transition_in(each_blocks_1[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks_1 = each_blocks_1.filter(Boolean);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				transition_out(each_blocks_1[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(table);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let sorted_rows;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Table', slots, []);
    	let { columns } = $$props;
    	let { values } = $$props;
    	let { identifier } = $$props;
    	let { initial_sort_column = 0 } = $$props;
    	let { links_are_external = true } = $$props;
    	const sort_directions = { asc: 1, desc: -1 };

    	const get_actual_value = row_element => typeof row_element === `object`
    	? row_element.text
    	: row_element;

    	const display_column = (column, value) => {
    		const is_number = typeof column === `object` && column.type === `number` && `fixed` in column;
    		const actual_value = get_actual_value(value);

    		if (is_number) {
    			return actual_value.toFixed(column.fixed);
    		}

    		return actual_value;
    	};

    	let sort = null;

    	const apply_sort = column_index => {
    		const next_sort_direction = sort?.column_index === column_index && sort.direction === sort_directions.desc
    		? sort_directions.asc
    		: sort_directions.desc;

    		$$invalidate(3, sort = {
    			column_index,
    			direction: next_sort_direction
    		});
    	};

    	const prevent_default_on_multiple_clicks = event => {
    		const click_count = event.detail;

    		if (click_count > 1) {
    			event.preventDefault();
    		}
    	};

    	const writable_props = ['columns', 'values', 'identifier', 'initial_sort_column', 'links_are_external'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Table> was created with unknown prop '${key}'`);
    	});

    	const click_handler = column_index => apply_sort(column_index);

    	$$self.$$set = $$props => {
    		if ('columns' in $$props) $$invalidate(0, columns = $$props.columns);
    		if ('values' in $$props) $$invalidate(8, values = $$props.values);
    		if ('identifier' in $$props) $$invalidate(1, identifier = $$props.identifier);
    		if ('initial_sort_column' in $$props) $$invalidate(9, initial_sort_column = $$props.initial_sort_column);
    		if ('links_are_external' in $$props) $$invalidate(2, links_are_external = $$props.links_are_external);
    	};

    	$$self.$capture_state = () => ({
    		Arrows,
    		columns,
    		values,
    		identifier,
    		initial_sort_column,
    		links_are_external,
    		sort_directions,
    		get_actual_value,
    		display_column,
    		sort,
    		apply_sort,
    		prevent_default_on_multiple_clicks,
    		sorted_rows
    	});

    	$$self.$inject_state = $$props => {
    		if ('columns' in $$props) $$invalidate(0, columns = $$props.columns);
    		if ('values' in $$props) $$invalidate(8, values = $$props.values);
    		if ('identifier' in $$props) $$invalidate(1, identifier = $$props.identifier);
    		if ('initial_sort_column' in $$props) $$invalidate(9, initial_sort_column = $$props.initial_sort_column);
    		if ('links_are_external' in $$props) $$invalidate(2, links_are_external = $$props.links_are_external);
    		if ('sort' in $$props) $$invalidate(3, sort = $$props.sort);
    		if ('sorted_rows' in $$props) $$invalidate(4, sorted_rows = $$props.sorted_rows);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*initial_sort_column*/ 512) {
    			apply_sort(initial_sort_column);
    		}

    		if ($$self.$$.dirty & /*values, sort*/ 264) {
    			$$invalidate(4, sorted_rows = values.slice().sort((row_a, row_b) => {
    				const value_a = get_actual_value(row_a[sort.column_index]);
    				const value_b = get_actual_value(row_b[sort.column_index]);

    				if (value_a === value_b) {
    					return 0;
    				} else if (value_a < value_b) {
    					return sort.direction;
    				} else {
    					return -sort.direction;
    				}
    			}));
    		}
    	};

    	return [
    		columns,
    		identifier,
    		links_are_external,
    		sort,
    		sorted_rows,
    		display_column,
    		apply_sort,
    		prevent_default_on_multiple_clicks,
    		values,
    		initial_sort_column,
    		click_handler
    	];
    }

    class Table extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance,
    			create_fragment,
    			safe_not_equal,
    			{
    				columns: 0,
    				values: 8,
    				identifier: 1,
    				initial_sort_column: 9,
    				links_are_external: 2
    			},
    			add_css
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Table",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*columns*/ ctx[0] === undefined && !('columns' in props)) {
    			console.warn("<Table> was created without expected prop 'columns'");
    		}

    		if (/*values*/ ctx[8] === undefined && !('values' in props)) {
    			console.warn("<Table> was created without expected prop 'values'");
    		}

    		if (/*identifier*/ ctx[1] === undefined && !('identifier' in props)) {
    			console.warn("<Table> was created without expected prop 'identifier'");
    		}
    	}

    	get columns() {
    		throw new Error("<Table>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set columns(value) {
    		throw new Error("<Table>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get values() {
    		throw new Error("<Table>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set values(value) {
    		throw new Error("<Table>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get identifier() {
    		throw new Error("<Table>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set identifier(value) {
    		throw new Error("<Table>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get initial_sort_column() {
    		throw new Error("<Table>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set initial_sort_column(value) {
    		throw new Error("<Table>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get links_are_external() {
    		throw new Error("<Table>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set links_are_external(value) {
    		throw new Error("<Table>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const affiliate_links = {
    	kai: `https://amzn.to/3DiMzSB`,
    	gingher: `https://amzn.to/3Eo3MLK`,
    	kleintools: `https://amzn.to/3DAPcPT`,
    	fiskars: `https://amzn.to/3DlbAwh`,
    	livingo: `https://amzn.to/31yzJSI`,
    	bianco: `https://amzn.to/3ppQnwg`,
    	henchels: `https://amzn.to/3rAsC7B`,
    	scotch: `https://amzn.to/32NrOld`,
    	ultimaclassic: `https://amzn.to/3prbput`,
    	kitchenaid: `https://amzn.to/3ow3sVP`,
    	westscott: `https://amzn.to/3Gb2Yu7`,
    	singer: `https://amzn.to/2ZWRDOQ`,
    	acme: `https://amzn.to/31wWQgt`,
    	stanley: `https://amzn.to/3lzIKCy`,
    };

    const values = [
    	[{ text: `Kai`, link: affiliate_links.kai }, 254, 73, 220, 290, 330, 335, 460, 1 ],
    	[{ text: `Gingher`, link: affiliate_links.gingher }, 171, 31, 245, 310, 375, 350, 550, 2 ],
    	[{ text: `Klein Tools`, link: affiliate_links.kleintools }, 167, 24, 270, 320, 420, 435, 645, 2 ],
    	[ `Heritage`, 215, 28, 345, 410, 450, 490, 730, 2 ],
    	[{ text: `Fiskars`, link: affiliate_links.fiskars }, 126, 21, 355, 400, 410, 435, 725, 1 ],
    	[{ text: `Livingo`, link: affiliate_links.livingo }, 109, 13, 390, 440, 520, 555, 1000, 3 ],
    	[{ text: `Bianco`, link: affiliate_links.bianco }, 130, 20, 395, 485, 570, 590, 1235, 3 ],
    	[{ text: `Henchels`, link: affiliate_links.henchels }, 91, 22, 295, 460, 525, 635, 770, 2 ],
    	[{ text: `Scotch`, link: affiliate_links.scotch }, 77, 4, 410, 545, 585, 630, 1175, 3 ],
    	[{ text: `Ultima Classic`, link: affiliate_links.ultimaclassic }, 195, 19, 410, 440, 485, 510, 945, 3 ],
    	[{ text: `KitchenAid`, link: affiliate_links.kitchenaid }, 122, 9, 470, 515, 585, 635, 1270, 2 ],
    	[{ text: `Westscott`, link: affiliate_links.westscott }, 161, 14, 475, 525, 585, 610, 780, 5 ],
    	[{ text: `Singer`, link: affiliate_links.singer }, 67, 6, 560, 570, 700, 685, 1240, 3 ],
    	[{ text: `Acme`, link: affiliate_links.acme }, 185, 18, 575, 595, 675, 705, 1190, 3 ],
    	[{ text: `Stanley`, link: affiliate_links.stanley }, 92, 3.5, 610, 1015, 1075, 1230, 1650, 3 ],
    ];

    const columns = [
    	{ name: `Brand` },
    	{ name: `Weight (grams)`, type: `number` },
    	{ name: `Cost`, type: `number`, fixed: 2 },
    	{ name: `Initial sharpness`, type: `number` },
    	{ name: `Sharpness after 1000 cuts`, type: `number` },
    	{ name: `Sharpness after cardboard`, type: `number` },
    	{ name: `Sharpness after aluminum`, type: `number` },
    	{ name: `Sharpness after sandpaper`, type: `number` },
    	{ name: `Subjective ease of use/comfort`, type: `number` },
    ];

    const identifier = `ScissorsEverything`;

    const selector = `[data-table-identifier=${identifier}]`;

    new Table({
    	target: document.querySelector(selector),
    	props: {
    		values,
    		columns,
    		identifier,
    	},
    	hydrate: true,
    });

})();
