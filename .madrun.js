const {
    run,
    series,
    parallel,
} = require('madrun');

module.exports = {
    "format:scripts": () => 'prettier --write "./scripts/*.(js)"',
    "format:check": () => 'prettier --check "./public/**/*.(json|yml)"',
    "format": () => 'prettier --write "./public/**/*.(json|yml)"',
    "build_one_click_apps": () => 'node ./scripts/build_one_click_apps.js',
    "build_one_click_apps_v4": () => 'node ./scripts/build_one_click_apps_v4.js',
    clean: () => 'rm -rf dist && mkdir -p dist',
    prebuild: async () => await parallel('clean', "format"),
    "build": async () => await run('prebuild', 'build_one_click_apps', "build_one_click_apps_v4"),
    "validate_apps": () => 'node ./scripts/validate_apps.js',
    "publish": () => run('build'),
    "postpublish": () => './scripts/publish-from-actions.sh'
};