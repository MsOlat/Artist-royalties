
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
