const Component = require('react').Component
const PropTypes = require('prop-types')
const h = require('react-hyperscript')
const inherits = require('util').inherits
const connect = require('react-redux').connect
const actions = require('../../../store/actions')
const AccountModalContainer = require('./account-modal-container')
const { getSelectedIdentity } = require('../../../selectors/selectors')
const genAccountLink = require('../../../../lib/account-link.js')
const QrView = require('../../ui/qr-code')
const SimpleLabel = require('../../ui/simple-label')

import Button from '../../ui/button'

function mapStateToProps (state) {
  return {
    network: state.metamask.network,
    selectedIdentity: getSelectedIdentity(state),
    keyrings: state.metamask.keyrings,
  }
}

function mapDispatchToProps (dispatch) {
  return {
    // Is this supposed to be used somewhere?
    showQrView: (selected, identity) => dispatch(actions.showQrView(selected, identity)),
    showExportPrivateKeyModal: (network, wallet) => {
        const walletId = wallet.id;
        const enterprise = wallet.enterprise;
        const coin = wallet.coin;

        const baseUrl = 'https://' + (network === "1" ? 'www.bitgo.com' : 'test.bitgo.com')
        const urlExtension = '/enterprise/' + enterprise + '/coin/' + coin + '/' + walletId + '/transactions'
        console.log(baseUrl + urlExtension)
        global.platform.openWindow({ url: baseUrl + urlExtension })
    },
    hideModal: () => dispatch(actions.hideModal()),
    setAccountLabel: (address, label) => dispatch(actions.setAccountLabel(address, label)),
  }
}

inherits(AccountDetailsModal, Component)
function AccountDetailsModal () {
  Component.call(this)
}

AccountDetailsModal.contextTypes = {
  t: PropTypes.func,
}

module.exports = connect(mapStateToProps, mapDispatchToProps)(AccountDetailsModal)


// Not yet pixel perfect todos:
  // fonts of qr-header

AccountDetailsModal.prototype.render = function () {
  const {
    selectedIdentity,
    network,
    showExportPrivateKeyModal,
    setAccountLabel,
    keyrings,
  } = this.props
  const { name, address } = selectedIdentity

  const keyring = keyrings.find((kr) => {
    return kr.coinSpecific.baseAddress === address
  })

  let exportPrivateKeyFeatureEnabled = true

  return h(AccountModalContainer, {}, [
      h(SimpleLabel, {
        className: 'account-modal__name',
        defaultValue: name,
        onSubmit: label => setAccountLabel(address, label),
      }),

      h(QrView, {
        Qr: {
          data: address,
          network: network,
        },
      }),

      h('div.account-modal-divider'),

      h(Button, {
        type: 'primary',
        className: 'account-modal__button',
        onClick: () => global.platform.openWindow({ url: genAccountLink(address, network) }),
      }, this.context.t('etherscanView')),

      // Holding on redesign for Export Private Key functionality

      exportPrivateKeyFeatureEnabled ? h(Button, {
        type: 'primary',
        className: 'account-modal__button',
        onClick: () => showExportPrivateKeyModal(network, keyring),
      }, this.context.t('exportPrivateKey')) : null,

  ])
}
