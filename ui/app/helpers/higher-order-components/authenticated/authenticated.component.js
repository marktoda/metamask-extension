import React from 'react'
import PropTypes from 'prop-types'
import { Redirect, Route } from 'react-router-dom'
import { UNLOCK_ROUTE } from '../../constants/routes'

export default function Authenticated (props) {
  const { isUnlocked } = props

  switch (true) {
    case isUnlocked:
      return <Route { ...props } />
    // case !completedOnboarding:
    //   return <Redirect to={{ pathname: INITIALIZE_ROUTE }} />
    default:
      return <Redirect to={{ pathname: UNLOCK_ROUTE }} />
  }
}

Authenticated.propTypes = {
  isUnlocked: PropTypes.bool,
  completedOnboarding: PropTypes.bool,
}
