
;; Artist-royalties-contract
;; NFT-based music and art licensing contract with automatic royalty payments to creators on resale
;; This contract allows artists to mint NFTs with embedded royalty rates and ensures creators receive
;; automatic payments whenever their work is resold in the secondary market.

;; ==============================================
;; CONSTANTS
;; ==============================================

;; Error codes
(define-constant ERR-OWNER-ONLY (err u100))
(define-constant ERR-NOT-TOKEN-OWNER (err u101))
(define-constant ERR-TOKEN-NOT-FOUND (err u102))
(define-constant ERR-INVALID-ROYALTY (err u103))
(define-constant ERR-INSUFFICIENT-PAYMENT (err u104))
(define-constant ERR-TOKEN-ALREADY-EXISTS (err u105))
(define-constant ERR-INVALID-RECIPIENT (err u106))
(define-constant ERR-TRANSFER-FAILED (err u107))
(define-constant ERR-MINT-FAILED (err u108))
(define-constant ERR-UNAUTHORIZED (err u109))

;; Maximum royalty percentage (10% = 1000 basis points)
(define-constant MAX-ROYALTY-BPS u1000)

;; Basis points for percentage calculations (100% = 10000 basis points)
(define-constant BPS-DENOMINATOR u10000)

;; Contract owner (deployer)
(define-constant CONTRACT-OWNER tx-sender)

;; ==============================================
;; NFT DEFINITION
;; ==============================================

;; Define the main NFT asset for art and music
(define-non-fungible-token artist-nft uint)

;; ==============================================
;; DATA MAPS AND VARIABLES
;; ==============================================

;; Map to store token metadata and creator information
(define-map token-metadata
  { token-id: uint }
  {
    creator: principal,
    title: (string-ascii 64),
    description: (string-ascii 256),
    media-url: (string-ascii 256),
    royalty-bps: uint,
    mint-timestamp: uint,
    category: (string-ascii 32)
  }
)

;; Map to store current token ownership
(define-map token-owners
  { token-id: uint }
  { owner: principal }
)

;; Map to track licensing permissions and terms
(define-map licensing-terms
  { token-id: uint }
  {
    commercial-use: bool,
    derivative-works: bool,
    license-fee: uint,
    license-duration: uint
  }
)

;; Map to track active licenses
(define-map active-licenses
  { token-id: uint, licensee: principal }
  {
    license-start: uint,
    license-end: uint,
    fee-paid: uint,
    terms-accepted: bool
  }
)

;; Map to track total royalties earned by creators
(define-map creator-earnings
  { creator: principal }
  { total-earned: uint }
)

;; Counter for generating unique token IDs
(define-data-var next-token-id uint u1)

;; Contract pause state for emergency stops
(define-data-var contract-paused bool false)

;; Total number of minted tokens
(define-data-var total-supply uint u0)

;; ==============================================
;; PRIVATE FUNCTIONS
;; ==============================================

;; Check if contract is paused
(define-private (contract-not-paused)
  (not (var-get contract-paused))
)

;; Validate royalty basis points
(define-private (valid-royalty-bps (royalty-bps uint))
  (<= royalty-bps MAX-ROYALTY-BPS)
)

;; Get current block height as timestamp
(define-private (get-current-timestamp)
  block-height
)

;; Initialize creator earnings if not exists
(define-private (init-creator-earnings (creator principal))
  (if (is-none (map-get? creator-earnings { creator: creator }))
    (map-set creator-earnings { creator: creator } { total-earned: u0 })
    true
  )
)

;; ==============================================
;; PUBLIC FUNCTIONS - MINTING
;; ==============================================

;; Mint a new NFT with metadata and royalty settings
;; Only the creator can mint their own NFT
(define-public (mint-nft 
  (title (string-ascii 64))
  (description (string-ascii 256))
  (media-url (string-ascii 256))
  (category (string-ascii 32))
  (royalty-bps uint)
  (commercial-use bool)
  (derivative-works bool)
  (license-fee uint)
  (license-duration uint)
)
  (let 
    (
      (token-id (var-get next-token-id))
      (creator tx-sender)
      (timestamp (get-current-timestamp))
    )
    (begin
      ;; Validate contract state
      (asserts! (contract-not-paused) ERR-UNAUTHORIZED)
      
      ;; Validate royalty percentage
      (asserts! (valid-royalty-bps royalty-bps) ERR-INVALID-ROYALTY)
      
      ;; Attempt to mint the NFT
      (try! (nft-mint? artist-nft token-id creator))
      
      ;; Store token metadata
      (map-set token-metadata
        { token-id: token-id }
        {
          creator: creator,
          title: title,
          description: description,
          media-url: media-url,
          royalty-bps: royalty-bps,
          mint-timestamp: timestamp,
          category: category
        }
      )
      
      ;; Store token ownership
      (map-set token-owners
        { token-id: token-id }
        { owner: creator }
      )
      
      ;; Store licensing terms
      (map-set licensing-terms
        { token-id: token-id }
        {
          commercial-use: commercial-use,
          derivative-works: derivative-works,
          license-fee: license-fee,
          license-duration: license-duration
        }
      )
      
      ;; Initialize creator earnings
      (init-creator-earnings creator)
      
      ;; Update counters
      (var-set next-token-id (+ token-id u1))
      (var-set total-supply (+ (var-get total-supply) u1))
      
      ;; Return the minted token ID
      (ok token-id)
    )
  )
)

;; Batch mint multiple NFTs for a single creator
(define-public (batch-mint-nfts 
  (nft-data (list 10 {
    title: (string-ascii 64),
    description: (string-ascii 256),
    media-url: (string-ascii 256),
    category: (string-ascii 32),
    royalty-bps: uint,
    commercial-use: bool,
    derivative-works: bool,
    license-fee: uint,
    license-duration: uint
  }))
)
  (begin
    ;; Validate contract state
    (asserts! (contract-not-paused) ERR-UNAUTHORIZED)
    
    ;; Map over the list and mint each NFT
    (ok (map mint-nft-from-data nft-data))
  )
)

;; Helper function for batch minting
(define-private (mint-nft-from-data (data {
  title: (string-ascii 64),
  description: (string-ascii 256),
  media-url: (string-ascii 256),
  category: (string-ascii 32),
  royalty-bps: uint,
  commercial-use: bool,
  derivative-works: bool,
  license-fee: uint,
  license-duration: uint
}))
  (mint-nft 
    (get title data)
    (get description data)
    (get media-url data)
    (get category data)
    (get royalty-bps data)
    (get commercial-use data)
    (get derivative-works data)
    (get license-fee data)
    (get license-duration data)
  )
)

;; ==============================================
;; PUBLIC FUNCTIONS - TRANSFERS & ROYALTIES
;; ==============================================

;; Transfer NFT with automatic royalty payment to creator
(define-public (transfer-with-royalty 
  (token-id uint)
  (recipient principal)
  (sale-price uint)
)
  (let 
    (
      (current-owner (unwrap! (map-get? token-owners { token-id: token-id }) ERR-TOKEN-NOT-FOUND))
      (metadata (unwrap! (map-get? token-metadata { token-id: token-id }) ERR-TOKEN-NOT-FOUND))
      (creator (get creator metadata))
      (royalty-bps (get royalty-bps metadata))
      (royalty-amount (/ (* sale-price royalty-bps) BPS-DENOMINATOR))
      (seller-amount (- sale-price royalty-amount))
      (current-earnings (default-to { total-earned: u0 } (map-get? creator-earnings { creator: creator })))
    )
    (begin
      ;; Validate contract state
      (asserts! (contract-not-paused) ERR-UNAUTHORIZED)
      
      ;; Verify sender is current owner
      (asserts! (is-eq tx-sender (get owner current-owner)) ERR-NOT-TOKEN-OWNER)
      
      ;; Verify recipient is valid
      (asserts! (not (is-eq recipient tx-sender)) ERR-INVALID-RECIPIENT)
      
      ;; Verify sufficient payment
      (asserts! (>= sale-price royalty-amount) ERR-INSUFFICIENT-PAYMENT)
      
      ;; Transfer royalty to creator (if creator is different from seller)
      (if (not (is-eq creator tx-sender))
        (try! (stx-transfer? royalty-amount tx-sender creator))
        true
      )
      
      ;; Transfer remaining amount to seller (if different from buyer)
      (if (and (> seller-amount u0) (not (is-eq tx-sender recipient)))
        (try! (stx-transfer? seller-amount tx-sender tx-sender))
        true
      )
      
      ;; Transfer the NFT
      (try! (nft-transfer? artist-nft token-id tx-sender recipient))
      
      ;; Update ownership record
      (map-set token-owners
        { token-id: token-id }
        { owner: recipient }
      )
      
      ;; Update creator earnings
      (map-set creator-earnings
        { creator: creator }
        { total-earned: (+ (get total-earned current-earnings) royalty-amount) }
      )
      
      ;; Return success with transfer details
      (ok {
        token-id: token-id,
        from: tx-sender,
        to: recipient,
        sale-price: sale-price,
        royalty-paid: royalty-amount,
        creator: creator
      })
    )
  )
)

;; Direct transfer without sale (gift/inheritance)
(define-public (transfer-nft (token-id uint) (recipient principal))
  (let 
    (
      (current-owner (unwrap! (map-get? token-owners { token-id: token-id }) ERR-TOKEN-NOT-FOUND))
    )
    (begin
      ;; Validate contract state
      (asserts! (contract-not-paused) ERR-UNAUTHORIZED)
      
      ;; Verify sender is current owner
      (asserts! (is-eq tx-sender (get owner current-owner)) ERR-NOT-TOKEN-OWNER)
      
      ;; Verify recipient is valid
      (asserts! (not (is-eq recipient tx-sender)) ERR-INVALID-RECIPIENT)
      
      ;; Transfer the NFT
      (try! (nft-transfer? artist-nft token-id tx-sender recipient))
      
      ;; Update ownership record
      (map-set token-owners
        { token-id: token-id }
        { owner: recipient }
      )
      
      ;; Return success
      (ok token-id)
    )
  )
)

;; Calculate royalty amount for a given sale price and token
(define-read-only (calculate-royalty (token-id uint) (sale-price uint))
  (let 
    (
      (metadata (map-get? token-metadata { token-id: token-id }))
    )
    (match metadata
      data (ok (/ (* sale-price (get royalty-bps data)) BPS-DENOMINATOR))
      ERR-TOKEN-NOT-FOUND
    )
  )
)

;; Bulk transfer function for multiple NFTs
(define-public (bulk-transfer 
  (transfers (list 20 { token-id: uint, recipient: principal, sale-price: uint }))
)
  (begin
    ;; Validate contract state
    (asserts! (contract-not-paused) ERR-UNAUTHORIZED)
    
    ;; Execute all transfers
    (ok (map execute-single-transfer transfers))
  )
)

;; Helper function for bulk transfers
(define-private (execute-single-transfer (transfer-data { token-id: uint, recipient: principal, sale-price: uint }))
  (if (> (get sale-price transfer-data) u0)
    (transfer-with-royalty 
      (get token-id transfer-data)
      (get recipient transfer-data)
      (get sale-price transfer-data)
    )
    (transfer-nft 
      (get token-id transfer-data)
      (get recipient transfer-data)
    )
  )
)

;; ==============================================
;; PUBLIC FUNCTIONS - LICENSING
;; ==============================================

;; Purchase a license to use an NFT
(define-public (purchase-license (token-id uint) (license-duration uint))
  (let 
    (
      (metadata (unwrap! (map-get? token-metadata { token-id: token-id }) ERR-TOKEN-NOT-FOUND))
      (terms (unwrap! (map-get? licensing-terms { token-id: token-id }) ERR-TOKEN-NOT-FOUND))
      (creator (get creator metadata))
      (license-fee (get license-fee terms))
      (max-duration (get license-duration terms))
      (current-time (get-current-timestamp))
      (license-end (+ current-time license-duration))
    )
    (begin
      ;; Validate contract state
      (asserts! (contract-not-paused) ERR-UNAUTHORIZED)
      
      ;; Validate license duration
      (asserts! (<= license-duration max-duration) ERR-INVALID-ROYALTY)
      
      ;; Transfer license fee to creator
      (if (> license-fee u0)
        (try! (stx-transfer? license-fee tx-sender creator))
        true
      )
      
      ;; Record the license
      (map-set active-licenses
        { token-id: token-id, licensee: tx-sender }
        {
          license-start: current-time,
          license-end: license-end,
          fee-paid: license-fee,
          terms-accepted: true
        }
      )
      
      ;; Update creator earnings
      (let ((current-earnings (default-to { total-earned: u0 } (map-get? creator-earnings { creator: creator }))))
        (map-set creator-earnings
          { creator: creator }
          { total-earned: (+ (get total-earned current-earnings) license-fee) }
        )
      )
      
      ;; Return license details
      (ok {
        token-id: token-id,
        licensee: tx-sender,
        license-start: current-time,
        license-end: license-end,
        fee-paid: license-fee
      })
    )
  )
)

;; Check if a user has a valid license for an NFT
(define-read-only (has-valid-license (token-id uint) (licensee principal))
  (let 
    (
      (license (map-get? active-licenses { token-id: token-id, licensee: licensee }))
      (current-time (get-current-timestamp))
    )
    (match license
      license-data 
        (and 
          (get terms-accepted license-data)
          (>= current-time (get license-start license-data))
          (<= current-time (get license-end license-data))
        )
      false
    )
  )
)

;; ==============================================
;; READ-ONLY FUNCTIONS - GETTERS
;; ==============================================

;; Get token metadata
(define-read-only (get-token-metadata (token-id uint))
  (map-get? token-metadata { token-id: token-id })
)

;; Get token owner
(define-read-only (get-token-owner (token-id uint))
  (map-get? token-owners { token-id: token-id })
)

;; Get licensing terms for a token
(define-read-only (get-licensing-terms (token-id uint))
  (map-get? licensing-terms { token-id: token-id })
)

;; Get creator total earnings
(define-read-only (get-creator-earnings (creator principal))
  (map-get? creator-earnings { creator: creator })
)

;; Get active license details
(define-read-only (get-license-details (token-id uint) (licensee principal))
  (map-get? active-licenses { token-id: token-id, licensee: licensee })
)

;; Get contract statistics
(define-read-only (get-contract-stats)
  (ok {
    total-supply: (var-get total-supply),
    next-token-id: (var-get next-token-id),
    contract-paused: (var-get contract-paused)
  })
)

;; Get NFT URI (for metadata standards)
(define-read-only (get-token-uri (token-id uint))
  (let ((metadata (map-get? token-metadata { token-id: token-id })))
    (match metadata
      data (ok (some (get media-url data)))
      (ok none)
    )
  )
)

;; ==============================================
;; ADMIN FUNCTIONS
;; ==============================================

;; Pause/unpause contract (emergency function)
(define-public (set-contract-paused (paused bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-OWNER-ONLY)
    (var-set contract-paused paused)
    (ok paused)
  )
)

;; Update licensing terms for a token (creator only)
(define-public (update-licensing-terms 
  (token-id uint)
  (commercial-use bool)
  (derivative-works bool)
  (license-fee uint)
  (license-duration uint)
)
  (let ((metadata (unwrap! (map-get? token-metadata { token-id: token-id }) ERR-TOKEN-NOT-FOUND)))
    (begin
      ;; Only creator can update licensing terms
      (asserts! (is-eq tx-sender (get creator metadata)) ERR-UNAUTHORIZED)
      
      ;; Update licensing terms
      (map-set licensing-terms
        { token-id: token-id }
        {
          commercial-use: commercial-use,
          derivative-works: derivative-works,
          license-fee: license-fee,
          license-duration: license-duration
        }
      )
      
      (ok token-id)
    )
  )
)

;; ==============================================
;; SIP-009 NFT TRAIT COMPLIANCE
;; ==============================================

;; Get last token ID
(define-read-only (get-last-token-id)
  (ok (- (var-get next-token-id) u1))
)

;; Get owner of a specific token (SIP-009 compliant)
(define-read-only (get-owner (token-id uint))
  (let ((owner-data (map-get? token-owners { token-id: token-id })))
    (match owner-data
      data (ok (some (get owner data)))
      (ok none)
    )
  )
)

;; Transfer function for SIP-009 compliance
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender sender) ERR-UNAUTHORIZED)
    (transfer-nft token-id recipient)
  )
)

;; ==============================================
;; CONTRACT INITIALIZATION
;; ==============================================

;; Initialize contract with deployment metadata
(define-data-var contract-initialized bool false)

(define-private (initialize-contract)
  (begin
    (var-set contract-initialized true)
    (print {
      event: "contract-deployed",
      deployer: CONTRACT-OWNER,
      timestamp: (get-current-timestamp),
      version: "1.0.0"
    })
  )
)

;; Call initialization on deployment
(initialize-contract)
