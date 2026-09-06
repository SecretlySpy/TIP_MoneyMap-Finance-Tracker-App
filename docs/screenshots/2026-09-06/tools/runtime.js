(() => {
  const moduleByPath = (path) => {
    const entry = [...__r.getModules()].find(([, m]) => m.verboseName === path);
    if (!entry) throw new Error(`Module not loaded: ${path}`);
    return __r(entry[0]);
  };
  const walk = (fiber, predicate) => {
    if (!fiber) return null;
    if (predicate(fiber)) return fiber;
    return walk(fiber.child, predicate) || walk(fiber.sibling, predicate);
  };
  const find = (predicate) => {
    for (const id of __REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.keys()) {
      for (const root of __REACT_DEVTOOLS_GLOBAL_HOOK__.getFiberRoots(id)) {
        const match = walk(root.current, predicate);
        if (match) return match;
      }
    }
    return null;
  };
  const findScreen = (id) => find(f => f.type?.name === 'ScreenContainer' && f.memoizedProps?.testID === id);
  const textOf = (node) => {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textOf).join('');
    return node?.props ? textOf(node.props.children) : '';
  };
  globalThis.__moneyMapCapture = {
    moduleByPath, find, walk,
    nav: moduleByPath('src/navigation/navigationRef.js').navigationRef,
    finance: moduleByPath('src/store/financeStore.js').useFinanceStore,
    ui: moduleByPath('src/store/uiStore.js').useUiStore,
    measure(id) {
      const screen = findScreen(id);
      if (!screen) throw new Error(`Screen not mounted: ${id}`);
      const scrolls = [];
      const visit = f => {
        if (!f) return;
        if (f.stateNode && typeof f.stateNode.getInnerViewRef === 'function') scrolls.push(f.stateNode);
        if (f.child) visit(f.child);
        if (f.sibling) visit(f.sibling);
      };
      visit(screen.child);
      this.scrolls = scrolls;
      this.measurements = scrolls.map(s => ({horizontal: s.props.horizontal === true}));
      scrolls.forEach((s, i) => {
        s.getInnerViewRef()?.measure((x,y,w,h,px,py) => {this.measurements[i].content={x,y,w,h,px,py};});
        s.getNativeScrollRef()?.measure((x,y,w,h,px,py) => {this.measurements[i].viewport={x,y,w,h,px,py};});
      });
      return scrolls.length;
    },
    navigate(tab, screen, params) {
      if (!tab) {
        this.nav.resetRoot({index:0,routes:[{name:'Main'},{name:screen,params}],index:1});
      } else {
        this.nav.resetRoot({index:0,routes:[{name:'Main',state:{index:0,routes:[{name:tab,state:{index:0,routes:[{name:screen,params}]}}]}}]});
      }
      return true;
    },
    press(label) {
      const f = find(f => typeof f.memoizedProps?.onPress === 'function' &&
        (f.memoizedProps.accessibilityLabel === label || textOf(f.memoizedProps.children) === label));
      if (!f) throw new Error(`Button not found: ${label}`);
      f.memoizedProps.onPress();
      return true;
    },
    confirmPrompt(title,value) {
      const f = find(f => f.type?.name === 'TextPromptModal' && f.memoizedProps?.visible && f.memoizedProps.title === title);
      if (!f) throw new Error(`Prompt not found: ${title}`);
      f.memoizedProps.onConfirm(value);
      return true;
    },
    screenIds() {
      const ids = new Set();
      find(f => {if(f.type?.name === 'ScreenContainer') ids.add(f.memoizedProps.testID); return false;});
      return [...ids];
    },
  };
  return {ready:true,screens:__moneyMapCapture.screenIds()};
})();
