import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [garageSaveSource, authGateway, mainMenu, profileBadge, authService, migration, usernameFunction, app] = await Promise.all([
  read("src/lib/garageSave.ts"),
  read("src/components/AuthGateway.tsx"),
  read("src/components/MainMenu.tsx"),
  read("src/components/UserProfileBadge.tsx"),
  read("src/lib/authService.ts"),
  read("supabase/migrations/202611050001_auth_profiles_and_cloud_saves.sql"),
  read("supabase/functions/username-login/index.ts"),
  read("src/App.tsx"),
]);

const garageSaveJavascript = ts.transpile(garageSaveSource, {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
});
const createSaveModule = (storage) => {
  const module = { exports: {} };
  vm.runInNewContext(garageSaveJavascript, {
    module,
    exports: module.exports,
    window: {
      sessionStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: (key) => storage.delete(key),
      },
    },
    JSON,
    Set,
    Math,
  });
  return module.exports;
};
const tabStorage = new Map();
const otherTabStorage = new Map();
const saves = createSaveModule(tabStorage);
const otherTabSaves = createSaveModule(otherTabStorage);
const guestSave = saves.storeGuestGarageSave({
  selectedCarId: "sf90",
  customization: { paintHex: "#123456", matteCarbon: true },
  settings: { graphicsQuality: "high", neonLightsOn: true },
});
assert.equal(guestSave.customization.paintHex, "#123456", "Guest paint customization should be retained");
assert.equal(guestSave.customization.matteCarbon, true, "Guest customization flags should be retained");
assert.equal(guestSave.settings.graphicsQuality, "high", "Guest settings should be retained");
assert.equal(saves.loadGuestGarageSave().settings.neonLightsOn, true, "Guest save data should round-trip through tab sessionStorage");
const isolatedSave = otherTabSaves.loadGuestGarageSave();
assert.equal(isolatedSave.customization.paintHex, otherTabSaves.DEFAULT_GARAGE_SAVE.customization.paintHex, "A separate tab should begin from its own default save");
assert.equal(otherTabStorage.size, 0, "Guest saves should remain isolated in per-tab sessionStorage");

assert.match(mainMenu, /mode="start"[\s\S]*onContinueGuest[\s\S]*onAuthenticated/, "START GAME should offer guest continuation and authenticated entry");
assert.match(authGateway, /CONTINUE AS GUEST[\s\S]*SIGN IN[\s\S]*SIGN UP/, "The auth gateway should offer all three entry choices");
assert.match(authGateway, /Username '\$\{candidate\}' is already registered\./, "Taken usernames should be explained inline");
assert.match(authGateway, /Passwords do not match\.[\s\S]*Confirm password/, "Sign-up should confirm matching passwords");
assert.match(`${profileBadge}${authGateway}`, /LINK ACCOUNT \/ SAVE PROGRESS[\s\S]*Convert Guest to Account/, "Guest profile UI should offer the account-link flow");
assert.match(app, /finishLinkingAccount[\s\S]*clearGuestGarageSave\(\)/, "Successful linking should attach cloud data and clear the guest-only save");
assert.match(migration, /create unique index[\s\S]*lower\(username\)/i, "The database should enforce case-insensitive username uniqueness");
assert.match(migration, /create or replace function public\.is_username_available/, "Username availability should be checked by the database");
assert.match(migration, /enable row level security[\s\S]*auth\.uid\(\) = id/i, "Cloud profiles should be protected by owner-scoped RLS");
assert.match(authService, /client\.rpc\("is_username_available"/, "The UI should query the live database for username availability");
assert.match(authService, /functions\.invoke\("username-login"/, "Username sign-in should use the server-side lookup function");
assert.match(usernameFunction, /SUPABASE_SERVICE_ROLE_KEY[\s\S]*signInWithPassword/, "The service-role key should stay in the Edge Function while Supabase Auth checks the password");
assert.match(app, /storeGuestGarageSave\(garageSaveData\)/, "Active guest garage changes should be persisted to the tab session");

console.log("PASS: guest session saves, auth entry choices, username uniqueness, account linking, and cloud access controls.");
