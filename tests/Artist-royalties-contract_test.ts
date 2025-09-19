
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// ===================================
// BASIC MINTING AND METADATA TESTS
// ===================================

Clarinet.test({
    name: "Successfully mint NFT with valid parameters",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("Test Art"),                    // title
                types.ascii("A beautiful test artwork"),     // description  
                types.ascii("https://example.com/art.jpg"), // media-url
                types.ascii("digital-art"),                 // category
                types.uint(500),                            // royalty-bps (5%)
                types.bool(true),                           // commercial-use
                types.bool(false),                          // derivative-works
                types.uint(1000),                          // license-fee
                types.uint(365)                            // license-duration
            ], wallet_1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk().expectUint(1);
        
        // Verify NFT ownership
        assertEquals(block.receipts[0].events.length, 1);
        assertEquals(block.receipts[0].events[0].type, 'nft_mint_event');
    },
});

Clarinet.test({
    name: "Get token metadata returns correct information",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        
        // First mint an NFT
        let block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("Music Track"),
                types.ascii("An amazing music track"),
                types.ascii("https://example.com/track.mp3"),
                types.ascii("music"),
                types.uint(750), // 7.5%
                types.bool(true),
                types.bool(true),
                types.uint(2000),
                types.uint(180)
            ], wallet_1.address)
        ]);
        
        // Get metadata
        let metadataQuery = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-token-metadata',
            [types.uint(1)],
            wallet_1.address
        );
        
        let metadata = metadataQuery.result.expectSome().expectTuple() as any;
        metadata['title'].expectAscii("Music Track");
        metadata['description'].expectAscii("An amazing music track");
        metadata['media-url'].expectAscii("https://example.com/track.mp3");
        metadata['category'].expectAscii("music");
        metadata['royalty-bps'].expectUint(750);
        metadata['creator'].expectPrincipal(wallet_1.address);
    },
});

Clarinet.test({
    name: "Reject minting with invalid royalty rate (>10%)",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("Test Art"),
                types.ascii("A beautiful test artwork"),
                types.ascii("https://example.com/art.jpg"),
                types.ascii("digital-art"),
                types.uint(1500), // 15% - exceeds maximum
                types.bool(true),
                types.bool(false),
                types.uint(1000),
                types.uint(365)
            ], wallet_1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(103); // ERR-INVALID-ROYALTY
    },
});

Clarinet.test({
    name: "Token ID increments correctly with multiple mints",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        const wallet_2 = accounts.get('wallet_2')!;
        
        let block = chain.mineBlock([
            // First mint
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("Art 1"),
                types.ascii("First artwork"),
                types.ascii("https://example.com/art1.jpg"),
                types.ascii("digital-art"),
                types.uint(500),
                types.bool(true),
                types.bool(false),
                types.uint(1000),
                types.uint(365)
            ], wallet_1.address),
            
            // Second mint
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("Art 2"),
                types.ascii("Second artwork"),
                types.ascii("https://example.com/art2.jpg"),
                types.ascii("photography"),
                types.uint(800),
                types.bool(false),
                types.bool(true),
                types.uint(1500),
                types.uint(730)
            ], wallet_2.address)
        ]);
        
        assertEquals(block.receipts.length, 2);
        block.receipts[0].result.expectOk().expectUint(1);
        block.receipts[1].result.expectOk().expectUint(2);
        
        // Verify total supply updates
        let stats = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-contract-stats',
            [],
            wallet_1.address
        );
        
        let statsData = stats.result.expectOk().expectTuple() as any;
        statsData['total-supply'].expectUint(2);
        statsData['next-token-id'].expectUint(3);
    },
});

Clarinet.test({
    name: "Licensing terms are stored correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("Licensed Art"),
                types.ascii("Art with specific licensing"),
                types.ascii("https://example.com/licensed.jpg"),
                types.ascii("digital-art"),
                types.uint(600),
                types.bool(false), // no commercial use
                types.bool(true),  // derivative works allowed
                types.uint(5000),  // license fee
                types.uint(90)     // license duration
            ], wallet_1.address)
        ]);
        
        // Get licensing terms
        let termsQuery = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-licensing-terms',
            [types.uint(1)],
            wallet_1.address
        );
        
        let terms = termsQuery.result.expectSome().expectTuple() as any;
        terms['commercial-use'].expectBool(false);
        terms['derivative-works'].expectBool(true);
        terms['license-fee'].expectUint(5000);
        terms['license-duration'].expectUint(90);
    },
});

Clarinet.test({
    name: "Creator earnings are initialized correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("First Art"),
                types.ascii("Creator's first artwork"),
                types.ascii("https://example.com/first.jpg"),
                types.ascii("digital-art"),
                types.uint(400),
                types.bool(true),
                types.bool(false),
                types.uint(1000),
                types.uint(365)
            ], wallet_1.address)
        ]);
        
        // Check creator earnings are initialized to 0
        let earningsQuery = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-creator-earnings',
            [wallet_1.address],
            wallet_1.address
        );
        
        let earnings = earningsQuery.result.expectSome().expectTuple() as any;
        earnings['total-earned'].expectUint(0);
    },
});

Clarinet.test({
    name: "Batch mint multiple NFTs successfully",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'batch-mint-nfts', [
                types.list([
                    types.tuple({
                        'title': types.ascii("Batch Art 1"),
                        'description': types.ascii("First batch artwork"),
                        'media-url': types.ascii("https://example.com/batch1.jpg"),
                        'category': types.ascii("digital-art"),
                        'royalty-bps': types.uint(300),
                        'commercial-use': types.bool(true),
                        'derivative-works': types.bool(false),
                        'license-fee': types.uint(500),
                        'license-duration': types.uint(180)
                    }),
                    types.tuple({
                        'title': types.ascii("Batch Art 2"),
                        'description': types.ascii("Second batch artwork"),
                        'media-url': types.ascii("https://example.com/batch2.jpg"),
                        'category': types.ascii("photography"),
                        'royalty-bps': types.uint(700),
                        'commercial-use': types.bool(false),
                        'derivative-works': types.bool(true),
                        'license-fee': types.uint(800),
                        'license-duration': types.uint(90)
                    })
                ])
            ], wallet_1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk();
        
        // Verify both NFTs were minted
        assertEquals(block.receipts[0].events.length, 2);
        assertEquals(block.receipts[0].events[0].type, 'nft_mint_event');
        assertEquals(block.receipts[0].events[1].type, 'nft_mint_event');
    },
});

Clarinet.test({
    name: "Get token owner returns correct owner information",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("Owner Test"),
                types.ascii("Testing ownership"),
                types.ascii("https://example.com/owner.jpg"),
                types.ascii("digital-art"),
                types.uint(500),
                types.bool(true),
                types.bool(false),
                types.uint(1000),
                types.uint(365)
            ], wallet_1.address)
        ]);
        
        // Get token owner
        let ownerQuery = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-token-owner',
            [types.uint(1)],
            wallet_1.address
        );
        
        let ownerData = ownerQuery.result.expectSome().expectTuple() as any;
        ownerData['owner'].expectPrincipal(wallet_1.address);
        
        // Also test SIP-009 compliant get-owner function
        let sip009OwnerQuery = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-owner',
            [types.uint(1)],
            wallet_1.address
        );
        
        sip009OwnerQuery.result.expectOk().expectSome().expectPrincipal(wallet_1.address);
    },
});

Clarinet.test({
    name: "Get non-existent token returns none/error",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        
        // Try to get metadata for non-existent token
        let metadataQuery = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-token-metadata',
            [types.uint(999)],
            wallet_1.address
        );
        
        metadataQuery.result.expectNone();
        
        // Try to get owner for non-existent token
        let ownerQuery = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-owner',
            [types.uint(999)],
            wallet_1.address
        );
        
        ownerQuery.result.expectOk().expectNone();
    },
});

Clarinet.test({
    name: "Calculate royalty amount correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        
        // First mint an NFT with 7.5% royalty
        let block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("Royalty Test"),
                types.ascii("Testing royalty calculation"),
                types.ascii("https://example.com/royalty.jpg"),
                types.ascii("digital-art"),
                types.uint(750), // 7.5%
                types.bool(true),
                types.bool(false),
                types.uint(1000),
                types.uint(365)
            ], wallet_1.address)
        ]);
        
        // Calculate royalty for 1000 STX sale
        let royaltyQuery = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'calculate-royalty',
            [types.uint(1), types.uint(1000000)], // 1000 STX in microSTX
            wallet_1.address
        );
        
        royaltyQuery.result.expectOk().expectUint(75000); // 75 STX in microSTX (7.5% of 1000)
    },
});

Clarinet.test({
    name: "Get last token ID returns correct value",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        
        // Initially should be 0 (no tokens minted)
        let lastTokenQuery1 = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-last-token-id',
            [],
            wallet_1.address
        );
        
        lastTokenQuery1.result.expectOk().expectUint(0);
        
        // Mint a token
        let block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("Last Token Test"),
                types.ascii("Testing last token ID"),
                types.ascii("https://example.com/last.jpg"),
                types.ascii("digital-art"),
                types.uint(500),
                types.bool(true),
                types.bool(false),
                types.uint(1000),
                types.uint(365)
            ], wallet_1.address)
        ]);
        
        // Now should be 1
        let lastTokenQuery2 = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-last-token-id',
            [],
            wallet_1.address
        );
        
        lastTokenQuery2.result.expectOk().expectUint(1);
    },
});

Clarinet.test({
    name: "Get token URI returns correct media URL",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        const mediaUrl = "https://example.com/uri-test.jpg";
        
        let block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("URI Test"),
                types.ascii("Testing token URI"),
                types.ascii(mediaUrl),
                types.ascii("digital-art"),
                types.uint(500),
                types.bool(true),
                types.bool(false),
                types.uint(1000),
                types.uint(365)
            ], wallet_1.address)
        ]);
        
        // Get token URI
        let uriQuery = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-token-uri',
            [types.uint(1)],
            wallet_1.address
        );
        
        uriQuery.result.expectOk().expectSome().expectAscii(mediaUrl);
        
        // Test non-existent token
        let uriQuery2 = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-token-uri',
            [types.uint(999)],
            wallet_1.address
        );
        
        uriQuery2.result.expectOk().expectNone();
    },
});

// ===================================
// TRANSFER AND ROYALTY PAYMENT TESTS
// ===================================

Clarinet.test({
    name: "Successfully transfer NFT with royalty payment",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!; // Creator
        const wallet_2 = accounts.get('wallet_2')!; // Buyer
        
        // First mint an NFT
        let block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("Transfer Test"),
                types.ascii("Testing transfers with royalty"),
                types.ascii("https://example.com/transfer.jpg"),
                types.ascii("digital-art"),
                types.uint(500), // 5% royalty
                types.bool(true),
                types.bool(false),
                types.uint(1000),
                types.uint(365)
            ], wallet_1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(1);
        
        // Transfer the NFT with sale price
        let transferBlock = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'transfer-with-royalty', [
                types.uint(1), // token-id
                types.principal(wallet_2.address), // recipient
                types.uint(1000000) // sale-price (1000 STX in microSTX)
            ], wallet_1.address)
        ]);
        
        assertEquals(transferBlock.receipts.length, 1);
        let transferResult = transferBlock.receipts[0].result.expectOk().expectTuple() as any;
        transferResult['token-id'].expectUint(1);
        transferResult['from'].expectPrincipal(wallet_1.address);
        transferResult['to'].expectPrincipal(wallet_2.address);
        transferResult['sale-price'].expectUint(1000000);
        transferResult['royalty-paid'].expectUint(50000); // 5% of 1000000
        transferResult['creator'].expectPrincipal(wallet_1.address);
        
        // Verify ownership changed
        let ownerQuery = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-token-owner',
            [types.uint(1)],
            wallet_2.address
        );
        
        let ownerData = ownerQuery.result.expectSome().expectTuple() as any;
        ownerData['owner'].expectPrincipal(wallet_2.address);
    },
});

Clarinet.test({
    name: "Direct transfer without sale works correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!; // Creator
        const wallet_2 = accounts.get('wallet_2')!; // Recipient
        
        // First mint an NFT
        let block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("Gift Test"),
                types.ascii("Testing gift transfers"),
                types.ascii("https://example.com/gift.jpg"),
                types.ascii("digital-art"),
                types.uint(750), // 7.5% royalty
                types.bool(true),
                types.bool(false),
                types.uint(1000),
                types.uint(365)
            ], wallet_1.address)
        ]);
        
        // Direct transfer without sale
        let transferBlock = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'transfer-nft', [
                types.uint(1), // token-id
                types.principal(wallet_2.address) // recipient
            ], wallet_1.address)
        ]);
        
        assertEquals(transferBlock.receipts.length, 1);
        transferBlock.receipts[0].result.expectOk().expectUint(1);
        
        // Verify ownership changed
        let ownerQuery = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-token-owner',
            [types.uint(1)],
            wallet_2.address
        );
        
        let ownerData = ownerQuery.result.expectSome().expectTuple() as any;
        ownerData['owner'].expectPrincipal(wallet_2.address);
        
        // Verify no earnings were added to creator (since no sale)
        let earningsQuery = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-creator-earnings',
            [wallet_1.address],
            wallet_1.address
        );
        
        let earnings = earningsQuery.result.expectSome().expectTuple() as any;
        earnings['total-earned'].expectUint(0);
    },
});

Clarinet.test({
    name: "Creator earnings update correctly with royalty payments",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get('wallet_1')!;
        const buyer1 = accounts.get('wallet_2')!;
        const buyer2 = accounts.get('wallet_3')!;
        
        // Mint an NFT
        let block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("Earnings Test"),
                types.ascii("Testing creator earnings"),
                types.ascii("https://example.com/earnings.jpg"),
                types.ascii("digital-art"),
                types.uint(600), // 6% royalty
                types.bool(true),
                types.bool(false),
                types.uint(1000),
                types.uint(365)
            ], creator.address)
        ]);
        
        // First sale: creator to buyer1
        let sale1Block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'transfer-with-royalty', [
                types.uint(1),
                types.principal(buyer1.address),
                types.uint(1000000) // 1000 STX
            ], creator.address)
        ]);
        
        // Check creator earnings after first sale (should be 60 STX = 60000 microSTX)
        let earnings1 = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-creator-earnings',
            [creator.address],
            creator.address
        );
        
        let earningsData1 = earnings1.result.expectSome().expectTuple() as any;
        earningsData1['total-earned'].expectUint(60000);
        
        // Second sale: buyer1 to buyer2
        let sale2Block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'transfer-with-royalty', [
                types.uint(1),
                types.principal(buyer2.address),
                types.uint(2000000) // 2000 STX
            ], buyer1.address)
        ]);
        
        // Check creator earnings after second sale (should be 60 + 120 = 180 STX = 180000 microSTX)
        let earnings2 = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-creator-earnings',
            [creator.address],
            creator.address
        );
        
        let earningsData2 = earnings2.result.expectSome().expectTuple() as any;
        earningsData2['total-earned'].expectUint(180000);
    },
});

Clarinet.test({
    name: "Reject transfer from non-owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get('wallet_1')!;
        const nonOwner = accounts.get('wallet_2')!;
        const recipient = accounts.get('wallet_3')!;
        
        // Mint an NFT
        let block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("Owner Test"),
                types.ascii("Testing ownership validation"),
                types.ascii("https://example.com/owner-test.jpg"),
                types.ascii("digital-art"),
                types.uint(500),
                types.bool(true),
                types.bool(false),
                types.uint(1000),
                types.uint(365)
            ], creator.address)
        ]);
        
        // Try to transfer from non-owner
        let transferBlock = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'transfer-with-royalty', [
                types.uint(1),
                types.principal(recipient.address),
                types.uint(1000000)
            ], nonOwner.address) // Non-owner trying to transfer
        ]);
        
        assertEquals(transferBlock.receipts.length, 1);
        transferBlock.receipts[0].result.expectErr().expectUint(101); // ERR-NOT-TOKEN-OWNER
    },
});

Clarinet.test({
    name: "Reject transfer to self",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get('wallet_1')!;
        
        // Mint an NFT
        let block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("Self Transfer Test"),
                types.ascii("Testing self transfer rejection"),
                types.ascii("https://example.com/self.jpg"),
                types.ascii("digital-art"),
                types.uint(500),
                types.bool(true),
                types.bool(false),
                types.uint(1000),
                types.uint(365)
            ], creator.address)
        ]);
        
        // Try to transfer to self
        let transferBlock = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'transfer-nft', [
                types.uint(1),
                types.principal(creator.address) // Same as sender
            ], creator.address)
        ]);
        
        assertEquals(transferBlock.receipts.length, 1);
        transferBlock.receipts[0].result.expectErr().expectUint(106); // ERR-INVALID-RECIPIENT
    },
});

Clarinet.test({
    name: "Bulk transfer works correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get('wallet_1')!;
        const buyer1 = accounts.get('wallet_2')!;
        const buyer2 = accounts.get('wallet_3')!;
        
        // Mint multiple NFTs
        let mintBlock = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("Bulk Test 1"),
                types.ascii("First bulk transfer test"),
                types.ascii("https://example.com/bulk1.jpg"),
                types.ascii("digital-art"),
                types.uint(400),
                types.bool(true),
                types.bool(false),
                types.uint(1000),
                types.uint(365)
            ], creator.address),
            
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("Bulk Test 2"),
                types.ascii("Second bulk transfer test"),
                types.ascii("https://example.com/bulk2.jpg"),
                types.ascii("photography"),
                types.uint(600),
                types.bool(true),
                types.bool(false),
                types.uint(1000),
                types.uint(365)
            ], creator.address)
        ]);
        
        // Bulk transfer
        let transferBlock = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'bulk-transfer', [
                types.list([
                    types.tuple({
                        'token-id': types.uint(1),
                        'recipient': types.principal(buyer1.address),
                        'sale-price': types.uint(1000000) // With sale price
                    }),
                    types.tuple({
                        'token-id': types.uint(2),
                        'recipient': types.principal(buyer2.address),
                        'sale-price': types.uint(0) // Without sale price (gift)
                    })
                ])
            ], creator.address)
        ]);
        
        assertEquals(transferBlock.receipts.length, 1);
        transferBlock.receipts[0].result.expectOk();
        
        // Verify first transfer (with royalty)
        let owner1Query = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-token-owner',
            [types.uint(1)],
            buyer1.address
        );
        
        let owner1Data = owner1Query.result.expectSome().expectTuple() as any;
        owner1Data['owner'].expectPrincipal(buyer1.address);
        
        // Verify second transfer (gift)
        let owner2Query = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-token-owner',
            [types.uint(2)],
            buyer2.address
        );
        
        let owner2Data = owner2Query.result.expectSome().expectTuple() as any;
        owner2Data['owner'].expectPrincipal(buyer2.address);
    },
});

Clarinet.test({
    name: "SIP-009 transfer function works correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get('wallet_1')!;
        const recipient = accounts.get('wallet_2')!;
        
        // Mint an NFT
        let block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("SIP-009 Test"),
                types.ascii("Testing SIP-009 compliance"),
                types.ascii("https://example.com/sip009.jpg"),
                types.ascii("digital-art"),
                types.uint(500),
                types.bool(true),
                types.bool(false),
                types.uint(1000),
                types.uint(365)
            ], creator.address)
        ]);
        
        // Use SIP-009 transfer function
        let transferBlock = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'transfer', [
                types.uint(1), // token-id
                types.principal(creator.address), // sender (must match tx-sender)
                types.principal(recipient.address) // recipient
            ], creator.address)
        ]);
        
        assertEquals(transferBlock.receipts.length, 1);
        transferBlock.receipts[0].result.expectOk().expectUint(1);
        
        // Verify ownership changed
        let ownerQuery = chain.callReadOnlyFn(
            'Artist-royalties-contract',
            'get-owner',
            [types.uint(1)],
            recipient.address
        );
        
        ownerQuery.result.expectOk().expectSome().expectPrincipal(recipient.address);
    },
});

Clarinet.test({
    name: "Reject SIP-009 transfer with wrong sender",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const creator = accounts.get('wallet_1')!;
        const nonOwner = accounts.get('wallet_2')!;
        const recipient = accounts.get('wallet_3')!;
        
        // Mint an NFT
        let block = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'mint-nft', [
                types.ascii("SIP-009 Auth Test"),
                types.ascii("Testing SIP-009 auth"),
                types.ascii("https://example.com/sip009-auth.jpg"),
                types.ascii("digital-art"),
                types.uint(500),
                types.bool(true),
                types.bool(false),
                types.uint(1000),
                types.uint(365)
            ], creator.address)
        ]);
        
        // Try SIP-009 transfer with wrong sender parameter
        let transferBlock = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'transfer', [
                types.uint(1),
                types.principal(creator.address), // sender parameter
                types.principal(recipient.address)
            ], nonOwner.address) // tx-sender different from sender parameter
        ]);
        
        assertEquals(transferBlock.receipts.length, 1);
        transferBlock.receipts[0].result.expectErr().expectUint(109); // ERR-UNAUTHORIZED
    },
});

Clarinet.test({
    name: "Transfer non-existent token fails",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        const wallet_2 = accounts.get('wallet_2')!;
        
        // Try to transfer non-existent token
        let transferBlock = chain.mineBlock([
            Tx.contractCall('Artist-royalties-contract', 'transfer-with-royalty', [
                types.uint(999), // Non-existent token
                types.principal(wallet_2.address),
                types.uint(1000000)
            ], wallet_1.address)
        ]);
        
        assertEquals(transferBlock.receipts.length, 1);
        transferBlock.receipts[0].result.expectErr().expectUint(102); // ERR-TOKEN-NOT-FOUND
    },
});
