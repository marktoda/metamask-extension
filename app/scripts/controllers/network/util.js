const {
  KOVAN,
  MAINNET,
  KOVAN_CODE,
  KOVAN_DISPLAY_NAME,
  MAINNET_DISPLAY_NAME,
} = require('./enums')

const networkToNameMap = {
  [KOVAN]: KOVAN_DISPLAY_NAME,
  [MAINNET]: MAINNET_DISPLAY_NAME,
  [KOVAN_CODE]: KOVAN_DISPLAY_NAME,
}

const getNetworkDisplayName = key => networkToNameMap[key]

module.exports = {
  getNetworkDisplayName,
}
