// Dark mode. Loaded in <head> (not as a module) so the page never flashes white.
// First visit follows the device setting; after that, the moon button's choice is saved.
(function () {
  var KEY = "sls_theme";
  var root = document.documentElement;
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function prefersDark() { return !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches); }
  function apply(dark) {
    root.classList.toggle("dark", dark);
    var btn = document.getElementById("themeBtn");
    if (btn) {
      btn.setAttribute("aria-pressed", dark ? "true" : "false");
      btn.title = dark ? "Switch to light mode" : "Switch to dark mode";
    }
  }
  var s = saved();
  apply(s ? s === "dark" : prefersDark());

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("themeBtn");
    if (!btn) return;
    apply(root.classList.contains("dark"));
    btn.addEventListener("click", function () {
      var dark = !root.classList.contains("dark");
      apply(dark);
      try { localStorage.setItem(KEY, dark ? "dark" : "light"); } catch (e) {}
    });
  });
  // Follow the device if it changes and the player never picked.
  if (window.matchMedia) {
    var mq = matchMedia("(prefers-color-scheme: dark)");
    var onChange = function (e) { if (!saved()) apply(e.matches); };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
  }
})();
