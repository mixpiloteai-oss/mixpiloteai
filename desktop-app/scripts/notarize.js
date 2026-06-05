// Called by electron-builder after signing on macOS.
// Requires APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID env vars.
// No-ops if not on macOS or vars not set.
const { notarize } = require('@electron/notarize')

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') return
  if (!process.env.APPLE_ID) {
    console.log('[notarize] APPLE_ID not set -- skipping notarization')
    return
  }
  const appName = context.packager.appInfo.productFilename
  console.log(`[notarize] notarizing ${appName}...`)
  await notarize({
    tool: 'notarytool',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  })
}
