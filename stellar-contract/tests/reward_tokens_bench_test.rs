//! Benchmark tests for `_reward_tokens` storage-access optimisation.
//!
//! Each test records the Soroban CPU-instruction budget consumed by
//! `verify_material` (the only public entry-point that calls `_reward_tokens`)
//! under different supply-chain depths.  Run with:
//!
//!   cargo test --test reward_tokens_bench_test -- --nocapture

#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn setup(env: &Env) -> (ScavengerContractClient, Address) {
    env.mock_all_auths();
    let id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &id);

    let admin = Address::generate(env);
    client.initialize_admin(&admin);
    client.set_percentages(&admin, &10, &40);

    (client, admin)
}

fn new_participant(env: &Env, client: &ScavengerContractClient, role: ParticipantRole) -> Address {
    let addr = Address::generate(env);
    client.register_participant(&addr, &role, &symbol_short!("p"), &0, &0);
    addr
}

/// Submit a material, optionally walk it through `depth` collectors, then
/// verify it and return the CPU instructions consumed by `verify_material`.
fn measure_verify(env: &Env, client: &ScavengerContractClient, depth: usize) -> u64 {
    let recycler = new_participant(env, client, ParticipantRole::Recycler);
    let submitter = new_participant(env, client, ParticipantRole::Recycler);

    let material = client.submit_material(
        &WasteType::Metal,
        &2000,
        &submitter,
        &String::from_str(env, "bench"),
    );

    // Build a collector chain of `depth` hops
    let mut current_owner = submitter.clone();
    for _ in 0..depth {
        let collector = new_participant(env, client, ParticipantRole::Collector);
        client.transfer_waste(
            &material.id,
            &current_owner,
            &collector,
            &String::from_str(env, "hop"),
        );
        current_owner = collector;
    }

    let budget_before = env.budget().cpu_instruction_count();
    client.verify_material(&material.id, &recycler);
    let budget_after = env.budget().cpu_instruction_count();

    budget_after - budget_before
}

// ---------------------------------------------------------------------------
// Benchmark tests
// ---------------------------------------------------------------------------

#[test]
fn bench_reward_tokens_no_collectors() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let cpu = measure_verify(&env, &client, 0);
    println!("[bench] depth=0  cpu_instructions={cpu}");
    // Sanity: must complete without panicking
}

#[test]
fn bench_reward_tokens_one_collector() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let cpu = measure_verify(&env, &client, 1);
    println!("[bench] depth=1  cpu_instructions={cpu}");
}

#[test]
fn bench_reward_tokens_three_collectors() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let cpu = measure_verify(&env, &client, 3);
    println!("[bench] depth=3  cpu_instructions={cpu}");
}

#[test]
fn bench_reward_tokens_five_collectors() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let cpu = measure_verify(&env, &client, 5);
    println!("[bench] depth=5  cpu_instructions={cpu}");
}

/// Regression guard: the optimised path must not write the submitter's
/// participant record more than once per `_reward_tokens` call.
/// We verify this indirectly by checking the final token balance is correct
/// (double-write would double-count).
#[test]
fn regression_no_double_credit_to_submitter() {
    let env = Env::default();
    let (client, _) = setup(&env);

    let recycler = new_participant(&env, &client, ParticipantRole::Recycler);
    let submitter = new_participant(&env, &client, ParticipantRole::Recycler);

    // 2 kg Metal → 100 tokens total; no collectors → submitter gets all 100
    let material = client.submit_material(
        &WasteType::Metal,
        &2000,
        &submitter,
        &String::from_str(&env, "test"),
    );
    client.verify_material(&material.id, &recycler);

    let p = client.get_participant(&submitter).unwrap();
    assert_eq!(p.total_tokens_earned, 100, "submitter should receive exactly 100 tokens");
}

/// Verify that a collector in the chain still receives their share after the
/// optimisation (no regression on collector reward path).
#[test]
fn regression_collector_still_rewarded() {
    let env = Env::default();
    let (client, _) = setup(&env);

    let recycler = new_participant(&env, &client, ParticipantRole::Recycler);
    let submitter = new_participant(&env, &client, ParticipantRole::Recycler);
    let collector = new_participant(&env, &client, ParticipantRole::Collector);

    let material = client.submit_material(
        &WasteType::Metal,
        &2000,
        &submitter,
        &String::from_str(&env, "test"),
    );
    client.transfer_waste(
        &material.id,
        &submitter,
        &collector,
        &String::from_str(&env, "hop"),
    );
    client.verify_material(&material.id, &recycler);

    // collector_pct=10 → 10 tokens; collector is also final owner so gets 40+50=90 more
    let cp = client.get_participant(&collector).unwrap();
    assert_eq!(cp.total_tokens_earned, 100);

    let sp = client.get_participant(&submitter).unwrap();
    assert_eq!(sp.total_tokens_earned, 0);
}
