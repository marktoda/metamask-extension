const log = require('loglevel')
const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN
const _ = require('lodash');
const EventEmitter = require('events').EventEmitter
const ObservableStore = require('obs-store')
const filter = require('promise-filter')
const encryptor = require('browser-passworder')
const sigUtil = require('eth-sig-util')
const bitgo = require('bitgo');
const normalizeAddress = sigUtil.normalize
// Keyrings:
const SimpleKeyring = require('eth-simple-keyring')
const HdKeyring = require('eth-hd-keyring')
const keyringTypes = [
  SimpleKeyring,
  HdKeyring,
]

class KeyringController extends EventEmitter {

  // PUBLIC METHODS
  //
  // THE FIRST SECTION OF METHODS ARE PUBLIC-FACING,
  // MEANING THEY ARE USED BY CONSUMERS OF THIS CLASS.
  //
  // THEIR SURFACE AREA SHOULD BE CHANGED WITH GREAT CARE.

  constructor (opts) {
    super()
    const initState = opts.initState || {}
    this.keyringTypes = opts.keyringTypes ? keyringTypes.concat(opts.keyringTypes) : keyringTypes
    this.store = new ObservableStore(initState)
    this.memStore = new ObservableStore({
      // isUnlocked is true when we have a valid bitgo access token
      isUnlocked: false,
      // KeyringTypes is meaningless and oly for backward compatibility
      keyringTypes: this.keyringTypes.map(krt => krt.type),
      // Keyrings are BitGo wallet objects
      keyrings: [],
      // bitgo access token
      accessToken: '',
    })

    this.encryptor = opts.encryptor || encryptor
    this.keyrings = []
    this.getNetwork = opts.getNetwork
    this.setNetwork()
  }

  // Full Update
  // returns @object state
  //
  // Emits the `update` event and
  // returns a Promise that resolves to the current state.
  //
  // Frequently used to end asynchronous chains in this class,
  // indicating consumers can often either listen for updates,
  // or accept a state-resolving promise to consume their results.
  //
  // Not all methods end with this, that might be a nice refactor.
  fullUpdate () {
    this.emit('update', this.memStore.getState())
    return this.memStore.getState()
  }

  // Create New Vault And Keychain
  // @string password - The password to encrypt the vault with
  //
  // returns Promise( @object state )
  //
  // Destroys any old encrypted storage,
  // creates a new encrypted store with the given password,
  // randomly creates a new HD wallet with 1 account,
  // faucets that account on the testnet.
  createNewVaultAndKeychain (password) {
    return this.persistAllKeyrings(password)
      .then(this.createFirstKeyTree.bind(this, password))
      .then(this.persistAllKeyrings.bind(this, password))
      .then(this.fullUpdate.bind(this))
  }

  // CreateNewVaultAndRestore
  // @string password - The password to encrypt the vault with
  // @string seed - The BIP44-compliant seed phrase.
  //
  // returns Promise( @object state )
  //
  // Destroys any old encrypted storage,
  // creates a new encrypted store with the given password,
  // creates a new HD wallet from the given seed with 1 account.
  createNewVaultAndRestore (accessToken, seed) {
    if (typeof accessToken !== 'string') {
      return Promise.reject('Password must be text.')
    }
    this.clearKeyrings()
    return this.persistAllKeyrings(accessToken)
      .then(() => {
        return this.unlockKeyrings(accessToken)
      })
      .then((keyrings) => {
        return 'asdf'
      })
      .then((address) => {
        return null
      })
      .then(this.persistAllKeyrings.bind(this, password))
      .then(this.fullUpdate.bind(this))
  }

  // Set Locked
  // returns Promise( @object state )
  //
  // This method deallocates all secrets, and effectively locks metamask.
  async setLocked () {
    // set locked
    this.password = null
    this.memStore.updateState({ isUnlocked: false })
    // remove keyrings
    this.keyrings = []
    await this._updateMemStoreKeyrings()
    return this.fullUpdate()
  }

  // Submit Password
  // @string password
  //
  // returns Promise( @object state )
  //
  // Attempts to decrypt the current vault and load its keyrings
  // into memory.
  //
  // Temporarily also migrates any old-style vaults first, as well.
  // (Pre MetaMask 3.0.0)
  submitPassword (username, password, otp) {
    return this.unlockKeyrings(username, password, otp)
      .then((keyrings) => {
        this.keyrings = keyrings
        return this.fullUpdate()
      })
  }

  // Add New Keyring
  // @string type
  // @object opts
  //
  // returns Promise( @Keyring keyring )
  //
  // Adds a new Keyring of the given `type` to the vault
  // and the current decrypted Keyrings array.
  //
  // All Keyring classes implement a unique `type` string,
  // and this is used to retrieve them from the keyringTypes array.
  addNewKeyring (type, opts) {
    const Keyring = this.getKeyringClassForType(type)
    const keyring = new Keyring(opts)
    return keyring.getAccounts()
      .then((accounts) => {
        return this.checkForDuplicate(type, accounts)
      })
      .then(() => {
        this.keyrings.push(keyring)
        return this.persistAllKeyrings()
      })
      .then(() => this._updateMemStoreKeyrings())
      .then(() => this.fullUpdate())
      .then(() => {
        return keyring
      })
  }

  // Remove Empty Keyrings
  // returns Void
  //
  // Loops through the keyrings and removes the ones
  // with empty accounts (usually after removing the last / only account)
  // from a keyring
  async removeEmptyKeyrings () {
    const validKeyrings = []

    // Since getAccounts returns a promise
    // We need to wait to hear back form each keyring
    // in order to decide which ones are now valid (accounts.length > 0)

    await Promise.all(this.keyrings.map(async (keyring) => {
      const accounts = await keyring.getAccounts()
      if(accounts.length > 0){
        validKeyrings.push(keyring)
      }
    }))
    this.keyrings = validKeyrings

  }

  // For now just checks for simple key pairs
  // but in the future
  // should possibly add HD and other types
  //
  checkForDuplicate (type, newAccount) {
    return this.getAccounts()
      .then((accounts) => {
        switch (type) {
          case 'Simple Key Pair':
            const isNotIncluded = !accounts.find((key) => key === newAccount[0] || key === ethUtil.stripHexPrefix(newAccount[0]))
            return (isNotIncluded) ? Promise.resolve(newAccount) : Promise.reject(new Error('The account you\'re are trying to import is a duplicate'))
          default:
            return Promise.resolve(newAccount)
        }
      })
  }


  // Add New Account
  // @number keyRingNum
  //
  // returns Promise( @object state )
  //
  // Calls the `addAccounts` method on the Keyring
  // in the kryings array at index `keyringNum`,
  // and then saves those changes.
  addNewAccount (selectedKeyring) {
    return selectedKeyring.addAccounts(1)
      .then((accounts) => {
        accounts.forEach((hexAccount) => {
          this.emit('newAccount', hexAccount)
        })
      })
      .then(this.persistAllKeyrings.bind(this))
      .then(this._updateMemStoreKeyrings.bind(this))
      .then(this.fullUpdate.bind(this))
  }

  // Export Account
  // @string address
  //
  // returns Promise( @string privateKey )
  //
  // Requests the private key from the keyring controlling
  // the specified address.
  //
  // Returns a Promise that may resolve with the private key string.
  exportAccount (address) {
    try {
      return this.getKeyringForAccount(address)
        .then((keyring) => {
          return keyring.exportAccount(normalizeAddress(address))
        })
    } catch (e) {
      return Promise.reject(e)
    }
  }

  // Remove Account
  // @string address
  //
  // returns Promise( void )
  //
  // Removes a specific account from a keyring
  // If the account is the last/only one then it also removes the keyring.
  //
  // Returns a Promise.
  removeAccount (address) {
    return this.getKeyringForAccount(address)
      .then((keyring) => {
        // Not all the keyrings support this, so we have to check...
        if(typeof keyring.removeAccount === 'function') {
          keyring.removeAccount(address)
          this.emit('removedAccount', address)
          return keyring.getAccounts()

        } else {
          Promise.reject(`Keyring ${keyring.type} doesn't support account removal operations`)
        }
      })
      .then(accounts => {
        // Check if this was the last/only account
        if(accounts.length === 0){
          return this.removeEmptyKeyrings()
        }
      })
      .then(this.persistAllKeyrings.bind(this))
      .then(this._updateMemStoreKeyrings.bind(this))
      .then(this.fullUpdate.bind(this))
      .catch( e => {
        return Promise.reject(e)
      })
  }


  // Check whether a given pending approval is confirmed
  async checkPendingApprovalState (pendingApprovalId, from) {
    const accessToken = this.memStore.getState().accessToken;
    if (!accessToken) {
      return false;
    }
    this.bitgo.authenticateWithAccessToken({ accessToken });
    const wallets = this.keyrings.filter((keyring) => keyring.coinSpecific.baseAddress === from);
    if (wallets.length !== 1) {
      return false;
    }
    const walletId = wallets[0].id;

    const wallet = await this.bitgoBaseCoin.wallets().get({ id: walletId })
    const pendingApprovals = wallet.pendingApprovals();
    console.log(pendingApprovals);
    console.log(pendingApprovalId);
    console.log(from);
    const matchingPendingApproval = pendingApprovals.filter((approval) => approval.id() === pendingApprovalId);
    console.log(matchingPendingApproval);
    return matchingPendingApproval.length === 0 || matchingPendingApproval[0].state() === "approved";
  }


  // SIGNING METHODS
  //
  // This method signs tx and returns a promise for
  // TX Manager to update the state after signing

  async signTransaction (ethTx, _fromAddress, password, otp) {
    let { gasPrice, gasLimit, to, from, value, data } = ethTx;
    gasPrice = parseInt(gasPrice, 16);
    if (gasLimit) {
      gasLimit = parseInt(gasLimit, 16);
    }
    value = new BN(ethUtil.stripHexPrefix(value), 16);
    const accessToken = this.memStore.getState().accessToken;
    if (!accessToken) {
      throw new Error("No access token available");
    }
    this.bitgo.authenticateWithAccessToken({ accessToken });
    await this.bitgo.unlock({ otp })
    const buildParams = {
      address: to,
      amount: value.toString(10),
      data: data,
      gasPrice,
      gasLimit,
      walletPassphrase: password,
      otp
    }
    const wallets = this.keyrings.filter((keyring) => keyring.coinSpecific.baseAddress === from);
    if (wallets.length !== 1) {
      throw new Error(`No wallet id or too many wallet ids for ${from}`)
    }
    const walletId = wallets[0].id;

    const wallet = await this.bitgoBaseCoin.wallets().get({ id: walletId })
    const transaction = await wallet.send(buildParams)
    if (_.isNil(transaction.txid) && !_.isNil(transaction.pendingApproval)) {
      return transaction.pendingApproval.id
    } else {
      return transaction.txid
    }
  }

  // Sign Message
  // @object msgParams
  //
  // returns Promise(@buffer rawSig)
  //
  // Attempts to sign the provided @object msgParams.
  signMessage (msgParams) {
    const address = normalizeAddress(msgParams.from)
    return this.getKeyringForAccount(address)
      .then((keyring) => {
        return keyring.signMessage(address, msgParams.data)
      })
  }

  // Sign Personal Message
  // @object msgParams
  //
  // returns Promise(@buffer rawSig)
  //
  // Attempts to sign the provided @object msgParams.
  // Prefixes the hash before signing as per the new geth behavior.
  signPersonalMessage (msgParams) {
    const address = normalizeAddress(msgParams.from)
    return this.getKeyringForAccount(address)
      .then((keyring) => {
        return keyring.signPersonalMessage(address, msgParams.data)
      })
  }

  // Sign Typed Message (EIP712 https://github.com/ethereum/EIPs/pull/712#issuecomment-329988454)
  signTypedMessage (msgParams) {
    const address = normalizeAddress(msgParams.from)
    return this.getKeyringForAccount(address)
      .then((keyring) => {
        return keyring.signTypedData(address, msgParams.data)
      })
  }

  getWalletIds (accessToken) {
    return this.keyrings(accessToken).map((wallet) => wallet.id);
  }

  async getWallets (accessToken) {
    this.bitgo.authenticateWithAccessToken({ accessToken });
    const wallets = (await this.bitgoBaseCoin.wallets().list({ })).wallets
    return wallets.map((wallet) => wallet._wallet);
  }

  // PRIVATE METHODS
  //
  // THESE METHODS ARE ONLY USED INTERNALLY TO THE KEYRING-CONTROLLER
  // AND SO MAY BE CHANGED MORE LIBERALLY THAN THE ABOVE METHODS.

  // Create First Key Tree
  // returns @Promise
  //
  // Clears the vault,
  // creates a new one,
  // creates a random new HD Keyring with 1 account,
  // makes that account the selected account,
  // faucets that account on testnet,
  // puts the current seed words into the state tree.
  async createFirstKeyTree (accessToken) {
    await this.unlockKeyrings(accessToken);
    return new Promise((resolve) => {
      resolve();
    })
  }

  // Persist All Keyrings
  // @password string
  //
  // returns Promise
  //
  // Iterates the current `keyrings` array,
  // serializes each one into a serialized array,
  // encrypts that array with the provided `password`,
  // and persists that encrypted string to storage.
  persistAllKeyrings (password = this.password) {
    this.password = password;
    this.memStore.updateState({ isUnlocked: true });
    this.store.updateState({ vault: 'asdfasdfadsf' })
    return new Promise((resolve) => {
      resolve();
    })
  }

 setNetwork() {
   this.env = this.getNetwork() === "1" ? "prod" : "test"
   this.bitgo = new bitgo.BitGo({ env: this.env })
   this.bitgoBaseCoin = this.bitgo.coin(this.env === "prod" ? "eth" : "teth")
 }

  // Unlock Keyrings
  // @string password
  //
  // returns Promise( @array keyrings )
  //
  // Attempts to unlock the persisted encrypted storage,
  // initializing the persisted keyrings to RAM.
  async unlockKeyrings (username, password, otp) {
    this.setNetwork()
    const accessToken = await this.login(username, password, otp)

    await this.clearKeyrings()
    this.password = accessToken
    const wallets = await this.getWallets(accessToken);
    this.memStore.updateState({ isUnlocked: true, accessToken })
    await this.restoreKeyring(wallets);
    return this.keyrings
  }

  // Login to bitgo
  // @string username
  // @string password
  // @string otp
  //
  // returns Promise( @string accessToken )
  async login(username, password, otp) {
   const response = await this.bitgo.authenticate({ username, password, otp })
   return response.access_token
  }

  // Restore Keyring
  // @object serialized
  //
  // returns Promise( @Keyring deserialized )
  //
  // Attempts to initialize a new keyring from the provided
  // serialized payload.
  //
  // On success, returns the resulting @Keyring instance.
  restoreKeyring (wallets) {
    this.keyrings = wallets;
    return this._updateMemStoreKeyrings()
    .then(() => {
      return this.keyrings
    })
  }

  // Get Keyring Class For Type
  // @string type
  //
  // Returns @class Keyring
  //
  // Searches the current `keyringTypes` array
  // for a Keyring class whose unique `type` property
  // matches the provided `type`,
  // returning it if it exists.
  getKeyringClassForType (type) {
    return this.keyringTypes.find(kr => kr.type === type)
  }

  getKeyringsByType (type) {
    return this.keyrings
  }

  // Get Accounts
  // returns Promise( @Array[ @string accounts ] )
  //
  // Returns the public addresses of all current accounts
  // managed by all currently unlocked keyrings.
  async getAccounts () {
    const keyrings = this.keyrings || []

    return keyrings.map((kr) => {
      return kr.coinSpecific.baseAddress
    })
  }

  // Get Keyring For Account
  // @string address
  //
  // returns Promise(@Keyring keyring)
  //
  // Returns the currently initialized keyring that manages
  // the specified `address` if one exists.
  getKeyringForAccount (address) {
    const hexed = normalizeAddress(address)
    log.debug(`KeyringController - getKeyringForAccount: ${hexed}`)

    return Promise.all(this.keyrings.map((keyring) => {
      return Promise.all([
        keyring,
        keyring.getAccounts(),
      ])
    }))
      .then(filter((candidate) => {
        const accounts = candidate[1].map(normalizeAddress)
        return accounts.includes(hexed)
      }))
      .then((winners) => {
        if (winners && winners.length > 0) {
          return winners[0][0]
        } else {
          throw new Error('No keyring found for the requested account.')
        }
      })
  }

  // Display For Keyring
  // @Keyring keyring
  //
  // returns Promise( @Object { type:String, accounts:Array } )
  //
  // Is used for adding the current keyrings to the state object.
  displayForKeyring (keyring) {
    return keyring.getAccounts()
      .then((accounts) => {
        return {
          type: keyring.type,
          accounts: accounts.map(normalizeAddress),
        }
      })
  }

  // Add Gas Buffer
  // @string gas (as hexadecimal value)
  //
  // returns @string bufferedGas (as hexadecimal value)
  //
  // Adds a healthy buffer of gas to an initial gas estimate.
  addGasBuffer (gas) {
    const gasBuffer = new BN('100000', 10)
    const bnGas = new BN(ethUtil.stripHexPrefix(gas), 16)
    const correct = bnGas.add(gasBuffer)
    return ethUtil.addHexPrefix(correct.toString(16))
  }

  // Clear Keyrings
  //
  // Deallocates all currently managed keyrings and accounts.
  // Used before initializing a new vault.
  async clearKeyrings () {
    // clear keyrings from memory
    this.keyrings = []
    this.memStore.updateState({
      keyrings: [],
    })
  }

  async _updateMemStoreKeyrings () {
    const keyrings = this.keyrings
    return this.memStore.updateState({ keyrings })
  }

}

module.exports = KeyringController
