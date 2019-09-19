const { Component } = require('react')
const PropTypes = require('prop-types')
const h = require('react-hyperscript')
const classnames = require('classnames')

class SimpleLabel extends Component {
  constructor (props) {
    super(props)

    this.state = {
      isEditing: false,
      value: props.defaultValue || '',
    }
  }

  handleSubmit () {
    const { value } = this.state

    if (value === '') {
      return
    }

    Promise.resolve(this.props.onSubmit(value))
      .then(() => this.setState({ isEditing: false }))
  }

  saveIfEnter (event) {
    if (event.key === 'Enter') {
      this.handleSubmit()
    }
  }

  renderReadonly () {
    return ([
      h('div.editable-label__value', this.state.value),
    ])
  }

  render () {
    const { className } = this.props

    return (
      h('div.editable-label', { className: classnames(className) }, this.renderReadonly())
    )
  }
}

SimpleLabel.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  defaultValue: PropTypes.string,
  className: PropTypes.string,
}

module.exports = SimpleLabel
