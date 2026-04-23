const fs = require('fs');
const path = 'C:\\\\Users\\\\Administrator\\\\Downloads\\\\KK-Studio-1.0.0\\\\src\\\\index.css';
let css = fs.readFileSync(path, 'utf8');

css = css.replace(
`body.dark-mode .settings-shell-mobile,
body.dark-mode .settings-shell-nav,
body.dark-mode .settings-shell-main {
  border: none;
  background:
    linear-gradient(180deg, rgba(38, 38, 42, 0.92) 0%, rgba(24, 24, 28, 0.94) 100%);
}

body.dark-mode .settings-shell-mobile__hero,
body.dark-mode .settings-shell-mobile__tabs,
body.dark-mode .settings-shell-nav__summary,
body.dark-mode .settings-shell-nav__footer,
body.dark-mode .settings-shell-loading-card {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}`,
``
);

css = css.replace(
`body.dark-mode .settings-sidebar-item {
  border-color: rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-secondary);
}

body.dark-mode .settings-sidebar-item:hover {
  border-color: rgba(129, 140, 248, 0.26);
  background: rgba(99, 102, 241, 0.12);
  color: var(--text-primary);
}

body.dark-mode .settings-sidebar-item.active {
  border-color: rgba(129, 140, 248, 0.42);
}`,
`body.dark-mode .settings-sidebar-item {
  border-color: transparent;
  background: transparent;
  color: var(--text-secondary);
}

body.dark-mode .settings-sidebar-item:hover {
  border-color: transparent;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}

body.dark-mode .settings-sidebar-item.active {
  border-color: transparent;
  background: rgba(255, 255, 255, 0.12);
}`
);

fs.writeFileSync(path, css);
console.log("Replaced successfully round 2");
