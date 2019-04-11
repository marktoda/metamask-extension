const Component = require('react').Component
const PropTypes = require('prop-types')
const h = require('react-hyperscript')
const connect = require('react-redux').connect
const classnames = require('classnames')
const inherits = require('util').inherits
const NetworkDropdownIcon = require('./dropdowns/components/network-dropdown-icon')

Network.contextTypes = {
  t: PropTypes.func,
}

module.exports = connect()(Network)


inherits(Network, Component)

function Network () {
  Component.call(this)
}

Network.prototype.render = function () {
  const props = this.props
  const context = this.context
  const networkNumber = props.network
  let providerName, providerNick, providerUrl
  try {
    providerName = props.provider.type
    providerNick = props.provider.nickname || ''
    providerUrl = props.provider.rpcTarget
  } catch (e) {
    providerName = null
  }
  const providerId = providerNick || providerName || providerUrl || null
  let iconName
  let hoverText

  if (providerName === 'mainnet') {
    hoverText = context.t('mainnet')
    iconName = 'ethereum-network'
  } else if (providerName === 'kovan') {
    hoverText = context.t('kovan')
    iconName = 'kovan-test-network'
  } else {
    hoverText = providerId
    iconName = 'private-network'
  }

  return (
    h('div.network-component.pointer', {
      className: classnames({
        'network-component--disabled': this.props.disabled,
        'ethereum-network': providerName === 'mainnet',
        'kovan-test-network': providerName === 'kovan',
      }),
      title: hoverText,
      onClick: (event) => {
        if (!this.props.disabled) {
          this.props.onClick(event)
        }
      },
    }, [
      (function () {
        switch (iconName) {
          case 'ethereum-network':
            return h('.network-indicator', [
              h(NetworkDropdownIcon, {
                backgroundColor: '#038789', // $blue-lagoon
                nonSelectBackgroundColor: '#15afb2',
                loading: networkNumber === 'loading',
              }),
              h('.network-name', context.t('mainnet')),
              h('i.fa.fa-chevron-down.fa-lg.network-caret'),
            ])
          case 'kovan-test-network':
            return h('.network-indicator', [
              h(NetworkDropdownIcon, {
                backgroundColor: '#690496', // $purple
                nonSelectBackgroundColor: '#b039f3',
                loading: networkNumber === 'loading',
              }),
              h('.network-name', context.t('kovan')),
              h('i.fa.fa-chevron-down.fa-lg.network-caret'),
            ])
          default:
            return h('.network-indicator', [
              networkNumber === 'loading'
              ? h('span.pointer.network-indicator', {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  flexDirection: 'row',
                },
                onClick: (event) => this.props.onClick(event),
              }, [
                h('img', {
                  title: context.t('attemptingConnect'),
                  style: {
                    width: '27px',
                  },
                  src: 'images/loading.svg',
                }),
              ])
              : h('i.fa.fa-question-circle.fa-lg', {
                style: {
                  margin: '10px',
                  color: 'rgb(125, 128, 130)',
                },
              }),

              h('.network-name', providerNick || context.t('privateNetwork')),
              h('i.fa.fa-chevron-down.fa-lg.network-caret'),
            ])
        }
      })(),
    ])
  )
}
