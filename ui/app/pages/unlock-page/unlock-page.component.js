import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Button from '@material-ui/core/Button'
import TextField from '../../components/ui/text-field'
import getCaretCoordinates from 'textarea-caret'
import { EventEmitter } from 'events'
import Mascot from '../../components/ui/mascot'
import { DEFAULT_ROUTE } from '../../helpers/constants/routes'

export default class UnlockPage extends Component {
  static contextTypes = {
    metricsEvent: PropTypes.func,
    t: PropTypes.func,
  }

  static propTypes = {
    history: PropTypes.object,
    isUnlocked: PropTypes.bool,
    onImport: PropTypes.func,
    onRestore: PropTypes.func,
    onSubmit: PropTypes.func,
    forceUpdateMetamaskState: PropTypes.func,
    showOptInModal: PropTypes.func,
  }

  constructor (props) {
    super(props)

    this.state = {
      password: '',
      username: '',
      otp: '',
      error: null,
    }

    this.submitting = false
    this.animationEventEmitter = new EventEmitter()
  }

  componentWillMount () {
    const { isUnlocked, history } = this.props

    if (isUnlocked) {
      history.push(DEFAULT_ROUTE)
    }
  }

  handleSubmit = async event => {
    event.preventDefault()
    event.stopPropagation()

    const { username, password, otp } = this.state
    const { onSubmit, forceUpdateMetamaskState, showOptInModal } = this.props

    if (password === '' || username === '' || otp === '' || this.submitting) {
      return
    }

    this.setState({ error: null })
    this.submitting = true

    try {
      await onSubmit(username, password, otp)
      const newState = await forceUpdateMetamaskState()
      this.context.metricsEvent({
        eventOpts: {
          category: 'Navigation',
          action: 'Unlock',
          name: 'Success',
        },
        isNewVisit: true,
      })

    } catch ({ message }) {
      if (message === 'Incorrect password') {
        const newState = await forceUpdateMetamaskState()
        this.context.metricsEvent({
          eventOpts: {
            category: 'Navigation',
            action: 'Unlock',
            name: 'Incorrect Password',
          },
          customVariables: {
            numberOfTokens: newState.tokens.length,
            numberOfAccounts: Object.keys(newState.accounts).length,
          },
        })
      }

      this.setState({ error: message })
      this.submitting = false
    }
  }

  handleInputChange ({ target }) {
    this.setState({ password: target.value, error: null })

    // tell mascot to look at page action
    const element = target
    const boundingRect = element.getBoundingClientRect()
    const coordinates = getCaretCoordinates(element, element.selectionEnd)
    this.animationEventEmitter.emit('point', {
      x: boundingRect.left + coordinates.left - element.scrollLeft,
      y: boundingRect.top + coordinates.top - element.scrollTop,
    })
  }

  handleNonPasswordInputChange ({ target }) {
    if (target.id === 'username') {
      this.setState({ username: target.value, error: null })
    } else if (target.id === 'otp') {
      this.setState({ otp: target.value, error: null })
    }
  }

  renderSubmitButton () {
    const style = {
      backgroundColor: '#f7861c',
      color: 'white',
      marginTop: '20px',
      height: '60px',
      fontWeight: '400',
      boxShadow: 'none',
      borderRadius: '4px',
    }

    return (
      <Button
        type="submit"
        style={style}
        disabled={!this.state.password }
        fullWidth
        variant="raised"
        size="large"
        onClick={this.handleSubmit}
        disableRipple
      >
        { this.context.t('login') }
      </Button>
    )
  }

  render () {
    const { username, password, otp, error } = this.state
    const { t } = this.context
    const { onImport, onRestore } = this.props

    return (
      <div className="unlock-page__container">
        <div className="unlock-page">
          <div className="unlock-page__mascot-container">
            <Mascot
              animationEventEmitter={this.animationEventEmitter}
              width="120"
              height="120"
            />
          </div>
          <h1 className="unlock-page__title">
            { t('welcomeBack') }
          </h1>
          <div>{ t('unlockMessage') }</div>
          <form
            className="unlock-page__form"
            onSubmit={this.handleSubmit}
          >
            <TextField
              id="username"
              label={t('username')}
              type="text"
              value={username}
              onChange={event => this.handleNonPasswordInputChange(event)}
              autoFocus
              material
              fullWidth
            />

            <TextField
              id="password"
              label={t('password')}
              type="password"
              value={password}
              onChange={event => this.handleInputChange(event)}
              autoComplete="current-password"
              material
              fullWidth
            />

            <TextField
              id="otp"
              label={t('otp')}
              type="text"
              value={otp}
              onChange={event => this.handleNonPasswordInputChange(event)}
              error={error}
              material
              fullWidth
            />
          </form>
          { this.renderSubmitButton() }
          <div className="unlock-page__links">
            <div
              className="unlock-page__link"
              onClick={() => onRestore()}
            >
              { t('restoreFromSeed') }
            </div>
            <div
              className="unlock-page__link unlock-page__link--import"
              onClick={() => onImport()}
            >
              { t('importUsingSeed') }
            </div>
          </div>
        </div>
      </div>
    )
  }
}
