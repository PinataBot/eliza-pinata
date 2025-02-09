module agent::agent;

use std::string::String;
use sui::display;
use sui::package::{Self, Publisher};
use sui::table_vec::{Self, TableVec};
use sui::url::{Self, Url};

// ========================= CONSTANTS =========================
// ========================= ERRORS =========================
const ENotAuthorized: u64 = 0;

// ========================= STRUCTS =========================

public struct AGENT has drop {}

public struct Agent has key, store {
    id: UID,
    name: String,
    character: String,
    image_url: Url,
    blobs: TableVec<String>,
}

// ========================= INIT =========================

fun init(otw: AGENT, ctx: &mut TxContext) {
    let publisher = package::claim(otw, ctx);

    let mut display = display::new<Agent>(&publisher, ctx);
    display.add(b"name".to_string(), b"{name}".to_string());
    display.add(b"image_url".to_string(), b"{image_url}".to_string());
    display.add(b"project_url".to_string(), b"https://www.pinatabot.com".to_string());
    display.add(b"creator".to_string(), b"Pinata".to_string());

    display.update_version();
    transfer::public_transfer(publisher, ctx.sender());
    transfer::public_transfer(display, ctx.sender());
}

// ========================= PUBLIC FUNCTIONS =========================

// ========================= Write admin functions

public fun new(
    name: vector<u8>,
    character: vector<u8>,
    image_url: vector<u8>,
    recipient: address,
    cap: &Publisher,
    ctx: &mut TxContext,
) {
    assert_admin(cap);

    let agent = Agent {
        id: object::new(ctx),
        name: name.to_string(),
        character: character.to_string(),
        image_url: url::new_unsafe_from_bytes(image_url),
        blobs: table_vec::empty(ctx),
    };

    transfer::transfer(agent, recipient);
}

// ========================= Write functions

public fun add_blob(agent: &mut Agent, blob: vector<u8>, _ctx: &mut TxContext) {
    agent.blobs.push_back(blob.to_string());
}

// ========================= PRIVATE FUNCTIONS =========================
fun assert_admin(cap: &Publisher) {
    assert!(cap.from_module<AGENT>(), ENotAuthorized);
}
