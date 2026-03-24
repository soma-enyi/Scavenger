# Scavngr - Stellar Recycling Platform

A decentralized recycling platform built on Stellar blockchain using Soroban smart contracts. Scavngr connects recyclers, collectors, and manufacturers in a transparent and efficient ecosystem.

## Project Structure

```
Scavenger/
├── stellar-contract/      # Soroban smart contract (Rust) - canonical implementation
│   ├── src/
│   │   ├── lib.rs        # Main contract implementation
│   │   ├── types.rs      # Types: ParticipantRole, Waste, Incentive, GlobalMetrics, etc.
│   │   ├── events.rs     # Contract event emitters
│   │   └── validation.rs # Input validation helpers
│   ├── tests/            # Integration and unit tests
│   └── Cargo.toml
├── frontend/             # React frontend (to be implemented)
├── Cargo.toml           # Workspace configuration
├── soroban.toml         # Soroban CLI configuration
└── README.md
```

## Features

- **Role-Based Participant System**: Recycler, Collector, and Manufacturer roles
- **Participant Registration**: On-chain participant management
- **Role Validation**: Permission checks for different actions
- **Soroban Storage**: Efficient on-chain data storage

## Prerequisites

- Rust 1.70+ with `wasm32-unknown-unknown` target
- Soroban CLI
- Stellar account with XLM (for deployment)

## Installation

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add WASM target
rustup target add wasm32-unknown-unknown

# Install Soroban CLI
cargo install --locked soroban-cli --features opt
```

## Build

```bash
# Build the contract
cargo build --release

# Build WASM
cd stellar-contract
cargo build --target wasm32-unknown-unknown --release

# Optimize WASM
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm
```

## Testing

```bash
# Run all tests
cargo test

# Run tests with output
cargo test -- --nocapture
```

## Deployment

### Local (Standalone Network)

```bash
# Start Stellar standalone
docker run --rm -it -p 8000:8000 \
  stellar/quickstart:latest --standalone --enable-soroban-rpc

# Deploy contract
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source <YOUR_SECRET_KEY> \
  --network standalone
```

### Testnet

```bash
# Generate keypair
soroban keys generate testnet-deployer

# Fund account
curl "https://friendbot.stellar.org?addr=$(soroban keys address testnet-deployer)"

# Deploy
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source testnet-deployer \
  --network testnet
```

## Contract API

### ParticipantRole Enum

```rust
pub enum ParticipantRole {
    Recycler = 0,      // Can collect and process recyclables
    Collector = 1,     // Can collect materials
    Manufacturer = 2,  // Can manufacture products
}
```

### Functions

**Admin**
- `initialize_admin(admin)` - Initialize contract admin (once)
- `transfer_admin(current_admin, new_admin)` - Transfer admin rights
- `set_charity_contract(admin, charity_address)` - Set charity address
- `set_token_address(admin, token_address)` - Set reward token address
- `set_percentages(admin, collector_pct, owner_pct)` - Set reward split percentages

**Participants**
- `register_participant(address, role, name, lat, lon)` - Register participant
- `get_participant(address)` - Get participant info
- `get_participant_info(address)` - Get participant + stats
- `update_role(address, new_role)` - Update participant role
- `deregister_participant(address)` - Deregister participant
- `is_participant_registered(address)` - Check registration

**Waste / Materials**
- `submit_material(submitter, waste_type, weight, lat, lon)` - Submit waste
- `submit_materials_batch(submitter, materials)` - Batch submit
- `verify_material(material_id, verifier)` - Verify a material
- `transfer_waste(waste_id, from, to, lat, lon, note)` - Transfer waste
- `confirm_waste_details(waste_id, confirmer)` - Confirm waste
- `reset_waste_confirmation(waste_id, owner)` - Reset confirmation
- `deactivate_waste(admin, waste_id)` - Deactivate waste
- `get_waste(waste_id)` / `get_material(material_id)` - Get waste by ID
- `get_participant_wastes(participant)` - List participant's waste IDs
- `get_waste_transfer_history(waste_id)` - Get transfer history

**Incentives**
- `create_incentive(rewarder, waste_type, reward_points, budget)` - Create incentive
- `update_incentive(incentive_id, rewarder, reward_points, budget)` - Update incentive
- `deactivate_incentive(incentive_id, rewarder)` - Deactivate incentive
- `get_incentive_by_id(incentive_id)` - Get incentive
- `get_incentives(waste_type)` - Get active incentives by waste type
- `get_active_incentives()` - Get all active incentives
- `get_active_mfr_incentive(manufacturer, waste_type)` - Best incentive for manufacturer
- `distribute_rewards(waste_id, incentive_id, manufacturer)` - Distribute supply chain rewards

**Stats & Metrics**
- `get_metrics()` - Global metrics (total wastes, total tokens)
- `get_stats(participant)` - Participant recycling stats
- `get_supply_chain_stats()` - Global supply chain stats

## Development

```bash
# Format code
cargo fmt

# Run linter
cargo clippy

# Watch for changes
cargo watch -x test
```

## CI/CD

GitHub Actions automatically:
- Runs tests on push/PR
- Checks code formatting
- Runs clippy linting
- Builds optimized WASM
- Uploads build artifacts

## License

MIT License - see LICENSE file for details
