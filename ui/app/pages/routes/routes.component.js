import classnames from 'classnames'
import PropTypes from 'prop-types'
import React, { Component } from 'react'
import { matchPath, Route, Switch } from 'react-router-dom'
import IdleTimer from 'react-idle-timer'

import FirstTimeFlow from '../first-time-flow'
import SendTransactionScreen from '../send'
import ConfirmTransaction from '../confirm-transaction'
import Sidebar from '../../components/app/sidebars'
import { WALLET_VIEW_SIDEBAR } from '../../components/app/sidebars/sidebar.constants'
import Home from '../home'
import Settings from '../settings'
import Authenticated from '../../helpers/higher-order-components/authenticated'
import Initialized from '../../helpers/higher-order-components/initialized'
import Lock from '../lock'
import PermissionsConnect from '../permissions-connect'
import ConnectedSites from '../connected-sites'
import RestoreVaultPage from '../keychains/restore-vault'
import RevealSeedConfirmation from '../keychains/reveal-seed'
import MobileSyncPage from '../mobile-sync'
import AddTokenPage from '../add-token'
import ConfirmAddTokenPage from '../confirm-add-token'
import ConfirmAddSuggestedTokenPage from '../confirm-add-suggested-token'
import CreateAccountPage from '../create-account'
import Loading from '../../components/ui/loading-screen'
import LoadingNetwork from '../../components/app/loading-network-screen'
import NetworkDropdown from '../../components/app/dropdowns/network-dropdown'
import AccountMenu from '../../components/app/account-menu'
import { Modal } from '../../components/app/modals'
import Alert from '../../components/ui/alert'
import AppHeader from '../../components/app/app-header'
import UnlockPage from '../unlock-page'

import {
  ADD_TOKEN_ROUTE,
  CONFIRM_ADD_SUGGESTED_TOKEN_ROUTE,
  CONFIRM_ADD_TOKEN_ROUTE,
  CONFIRM_TRANSACTION_ROUTE,
  CONNECT_ROUTE,
  CONNECTED_ROUTE,
  DEFAULT_ROUTE,
  INITIALIZE_ROUTE,
  INITIALIZE_UNLOCK_ROUTE,
  LOCK_ROUTE,
  MOBILE_SYNC_ROUTE,
  NEW_ACCOUNT_ROUTE,
  RESTORE_VAULT_ROUTE,
  REVEAL_SEED_ROUTE,
  SEND_ROUTE,
  SETTINGS_ROUTE,
  UNLOCK_ROUTE,
} from '../../helpers/constants/routes'

import { ENVIRONMENT_TYPE_NOTIFICATION, ENVIRONMENT_TYPE_POPUP } from '../../../../app/scripts/lib/enums'

export default class Routes extends Component {
  static propTypes = {
    currentCurrency: PropTypes.string,
    setCurrentCurrencyToUSD: PropTypes.func,
    isLoading: PropTypes.bool,
    loadingMessage: PropTypes.string,
    alertMessage: PropTypes.string,
    textDirection: PropTypes.string,
    network: PropTypes.string,
    provider: PropTypes.object,
    frequentRpcListDetail: PropTypes.array,
    sidebar: PropTypes.object,
    alertOpen: PropTypes.bool,
    hideSidebar: PropTypes.func,
    isUnlocked: PropTypes.bool,
    setLastActiveTime: PropTypes.func,
    history: PropTypes.object,
    location: PropTypes.object,
    lockMetaMask: PropTypes.func,
    submittedPendingTransactions: PropTypes.array,
    isMouseUser: PropTypes.bool,
    setMouseUserState: PropTypes.func,
    providerId: PropTypes.string,
    hasPermissionsRequests: PropTypes.bool,
    autoLockTimeLimit: PropTypes.number,
  }

  static contextTypes = {
    t: PropTypes.func,
    metricsEvent: PropTypes.func,
  }

  UNSAFE_componentWillMount () {
    const { currentCurrency, setCurrentCurrencyToUSD } = this.props

    if (!currentCurrency) {
      setCurrentCurrencyToUSD()
    }

    this.props.history.listen((locationObj, action) => {
      if (action === 'PUSH') {
        const url = `&url=${encodeURIComponent('http://www.metamask.io/metametrics' + locationObj.pathname)}`
        this.context.metricsEvent({}, {
          currentPath: '',
          pathname: locationObj.pathname,
          url,
          pageOpts: {
            hideDimensions: true,
          },
        })
      }
    })
  }

  renderRoutes () {
    const { autoLockTimeLimit, setLastActiveTime } = this.props

    const routes = (
      <Switch>
        <Route path={LOCK_ROUTE} component={Lock} exact />
        <Route path={INITIALIZE_ROUTE} component={FirstTimeFlow} />
        <Initialized path={UNLOCK_ROUTE} component={UnlockPage} exact />
        <Initialized path={RESTORE_VAULT_ROUTE} component={RestoreVaultPage} exact />
        <Authenticated path={REVEAL_SEED_ROUTE} component={RevealSeedConfirmation} exact />
        <Authenticated path={MOBILE_SYNC_ROUTE} component={MobileSyncPage} exact />
        <Authenticated path={SETTINGS_ROUTE} component={Settings} />
        <Authenticated path={`${CONFIRM_TRANSACTION_ROUTE}/:id?`} component={ConfirmTransaction} />
        <Authenticated path={SEND_ROUTE} component={SendTransactionScreen} exact />
        <Authenticated path={ADD_TOKEN_ROUTE} component={AddTokenPage} exact />
        <Authenticated path={CONFIRM_ADD_TOKEN_ROUTE} component={ConfirmAddTokenPage} exact />
        <Authenticated path={CONFIRM_ADD_SUGGESTED_TOKEN_ROUTE} component={ConfirmAddSuggestedTokenPage} exact />
        <Authenticated path={NEW_ACCOUNT_ROUTE} component={CreateAccountPage} />
        <Authenticated path={`${CONNECT_ROUTE}/:id`} component={PermissionsConnect} />
        <Authenticated path={CONNECTED_ROUTE} component={ConnectedSites} exact />
        <Authenticated path={DEFAULT_ROUTE} component={Home} exact />
      </Switch>
    )

    if (autoLockTimeLimit > 0) {
      return (
        <IdleTimer onAction={setLastActiveTime} throttle={1000}>
          {routes}
        </IdleTimer>
      )
    }

    return routes
  }

  onInitializationUnlockPage () {
    const { location } = this.props
    return Boolean(matchPath(location.pathname, { path: INITIALIZE_UNLOCK_ROUTE, exact: true }))
  }

  onConfirmPage () {
    const { location } = this.props
    return Boolean(matchPath(location.pathname, { path: CONFIRM_TRANSACTION_ROUTE, exact: false }))
  }

  hideAppHeader () {
    const { location, hasPermissionsRequests } = this.props

    const isInitializing = Boolean(matchPath(location.pathname, {
      path: INITIALIZE_ROUTE, exact: false,
    }))

    if (isInitializing && !this.onInitializationUnlockPage()) {
      return true
    }

    if (window.METAMASK_UI_TYPE === ENVIRONMENT_TYPE_NOTIFICATION) {
      return true
    }

    if (window.METAMASK_UI_TYPE === ENVIRONMENT_TYPE_POPUP) {
      return this.onConfirmPage() || hasPermissionsRequests
    }

    const isHandlingPermissionsRequest = Boolean(matchPath(location.pathname, {
      path: CONNECT_ROUTE, exact: false,
    }))

    if (hasPermissionsRequests || isHandlingPermissionsRequest) {
      return true
    }
  }

  render () {
    const {
      isLoading,
      alertMessage,
      textDirection,
      loadingMessage,
      network,
      provider,
      frequentRpcListDetail,
      setMouseUserState,
      sidebar,
      submittedPendingTransactions,
      isMouseUser,
    } = this.props
    const isLoadingNetwork = network === 'loading'
    const loadMessage = (loadingMessage || isLoadingNetwork)
      ? this.getConnectingLabel(loadingMessage)
      : null

    const {
      isOpen: sidebarIsOpen,
      transitionName: sidebarTransitionName,
      type: sidebarType,
      props,
    } = sidebar
    const { transaction: sidebarTransaction } = props || {}

    const sidebarOnOverlayClose = sidebarType === WALLET_VIEW_SIDEBAR
      ? () => {
        this.context.metricsEvent({
          eventOpts: {
            category: 'Navigation',
            action: 'Wallet Sidebar',
            name: 'Closed Sidebare Via Overlay',
          },
        })
      }
      : null

    const sidebarShouldClose = sidebarTransaction &&
      !sidebarTransaction.status === 'failed' &&
      !submittedPendingTransactions.find(({ id }) => id === sidebarTransaction.id)

    return (
      <div
        className={classnames('app', { 'mouse-user-styles': isMouseUser })}
        dir={textDirection}
        onClick={() => setMouseUserState(true)}
        onKeyDown={(e) => {
          if (e.keyCode === 9) {
            setMouseUserState(false)
          }
        }}
      >
        <Modal />
        <Alert
          visible={this.props.alertOpen}
          msg={alertMessage}
        />
        { !this.hideAppHeader() && (
          <AppHeader
            hideNetworkIndicator={this.onInitializationUnlockPage()}
            disabled={this.onConfirmPage()}
          />
        ) }
        <Sidebar
          sidebarOpen={sidebarIsOpen}
          sidebarShouldClose={sidebarShouldClose}
          hideSidebar={this.props.hideSidebar}
          transitionName={sidebarTransitionName}
          type={sidebarType}
          sidebarProps={sidebar.props}
          onOverlayClose={sidebarOnOverlayClose}
        />
        <NetworkDropdown
          provider={provider}
          frequentRpcListDetail={frequentRpcListDetail}
        />
        <AccountMenu />
        <div className="main-container-wrapper">
          { isLoading && <Loading loadingMessage={loadMessage} /> }
          { !isLoading && isLoadingNetwork && <LoadingNetwork /> }
          { this.renderRoutes() }
        </div>
      </div>
    )
  }

  toggleMetamaskActive () {
    if (!this.props.isUnlocked) {
      // currently inactive: redirect to password box
      const passwordBox = document.querySelector('input[type=password]')
      if (!passwordBox) {
        return
      }
      passwordBox.focus()
    } else {
      // currently active: deactivate
      this.props.lockMetaMask()
    }
  }

  getConnectingLabel (loadingMessage) {
    if (loadingMessage) {
      return loadingMessage
    }
    const { provider, providerId } = this.props

    switch (provider.type) {
      case 'mainnet':
        return this.context.t('connectingToMainnet')
      case 'ropsten':
        return this.context.t('connectingToRopsten')
      case 'kovan':
        return this.context.t('connectingToKovan')
      case 'rinkeby':
        return this.context.t('connectingToRinkeby')
      case 'localhost':
        return this.context.t('connectingToLocalhost')
      case 'goerli':
        return this.context.t('connectingToGoerli')
      default:
        return this.context.t('connectingTo', [providerId])
    }
  }

  getNetworkName () {
    switch (this.props.provider.type) {
      case 'mainnet':
        return this.context.t('mainnet')
      case 'ropsten':
        return this.context.t('ropsten')
      case 'kovan':
        return this.context.t('kovan')
      case 'rinkeby':
        return this.context.t('rinkeby')
      case 'localhost':
        return this.context.t('localhost')
      case 'goerli':
        return this.context.t('goerli')
      default:
        return this.context.t('unknownNetwork')
    }
  }
}
