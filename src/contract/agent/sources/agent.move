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

public struct Character has store {
    name: String,
    username: String,
    modelProvider: String,
    system: String,
    bio: String,
    lore: String,
    messageExamples: String,
    postExamples: String,
    topics: String,
    style: String,
    adjectives: String,
}

public struct Agent has key, store {
    id: UID,
    character: Character,
    image_url: Url,
    response_blobs: TableVec<String>,
    action_blobs: TableVec<String>,
}

// ========================= INIT =========================

fun init(otw: AGENT, ctx: &mut TxContext) {
    let publisher = package::claim(otw, ctx);

    let mut display = display::new<Agent>(&publisher, ctx);
    display.add(b"name".to_string(), b"{character.name}".to_string());
    display.add(b"description".to_string(), b"{character.bio}".to_string());
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
    username: vector<u8>,
    modelProvider: vector<u8>,
    system: vector<u8>,
    bio: vector<u8>,
    lore: vector<u8>,
    messageExamples: vector<u8>,
    postExamples: vector<u8>,
    topics: vector<u8>,
    style: vector<u8>,
    adjectives: vector<u8>,
    image_url: vector<u8>,
    recipient: address,
    cap: &Publisher,
    ctx: &mut TxContext,
) {
    assert_admin(cap);

    let character = Character {
        name: name.to_string(),
        username: username.to_string(),
        modelProvider: modelProvider.to_string(),
        system: system.to_string(),
        bio: bio.to_string(),
        lore: lore.to_string(),
        messageExamples: messageExamples.to_string(),
        postExamples: postExamples.to_string(),
        topics: topics.to_string(),
        style: style.to_string(),
        adjectives: adjectives.to_string(),
    };

    let agent = Agent {
        id: object::new(ctx),
        character: character,
        image_url: url::new_unsafe_from_bytes(image_url),
        response_blobs: table_vec::empty(ctx),
        action_blobs: table_vec::empty(ctx),
    };

    transfer::transfer(agent, recipient);
}

public fun new_without_character(
    image_url: vector<u8>,
    recipient: address,
    cap: &Publisher,
    ctx: &mut TxContext,
) {
    assert_admin(cap);

    let agent = Agent {
        id: object::new(ctx),
        character: Character {
            name: b"".to_string(),
            username: b"".to_string(),
            modelProvider: b"".to_string(),
            system: b"".to_string(),
            bio: b"".to_string(),
            lore: b"".to_string(),
            messageExamples: b"".to_string(),
            postExamples: b"".to_string(),
            topics: b"".to_string(),
            style: b"".to_string(),
            adjectives: b"".to_string(),
        },
        image_url: url::new_unsafe_from_bytes(image_url),
        response_blobs: table_vec::empty(ctx),
        action_blobs: table_vec::empty(ctx),
    };

    transfer::transfer(agent, recipient);
}

// ========================= Write functions

public fun update_character(
    agent: &mut Agent,
    name: vector<u8>,
    username: vector<u8>,
    modelProvider: vector<u8>,
    system: vector<u8>,
    bio: vector<u8>,
    lore: vector<u8>,
    messageExamples: vector<u8>,
    postExamples: vector<u8>,
    topics: vector<u8>,
    style: vector<u8>,
    adjectives: vector<u8>,
    _ctx: &mut TxContext,
) {
    agent.character.name = name.to_string();
    agent.character.username = username.to_string();
    agent.character.modelProvider = modelProvider.to_string();
    agent.character.system = system.to_string();
    agent.character.bio = bio.to_string();
    agent.character.lore = lore.to_string();
    agent.character.messageExamples = messageExamples.to_string();
    agent.character.postExamples = postExamples.to_string();
    agent.character.topics = topics.to_string();
    agent.character.style = style.to_string();
    agent.character.adjectives = adjectives.to_string();
}

public fun update_character_name(agent: &mut Agent, name: vector<u8>, _ctx: &mut TxContext) {
    agent.character.name = name.to_string();
}

public fun update_character_username(
    agent: &mut Agent,
    username: vector<u8>,
    _ctx: &mut TxContext,
) {
    agent.character.username = username.to_string();
}

public fun update_character_modelProvider(
    agent: &mut Agent,
    modelProvider: vector<u8>,
    _ctx: &mut TxContext,
) {
    agent.character.modelProvider = modelProvider.to_string();
}

public fun update_character_system(agent: &mut Agent, system: vector<u8>, _ctx: &mut TxContext) {
    agent.character.system = system.to_string();
}

public fun update_character_bio(agent: &mut Agent, bio: vector<u8>, _ctx: &mut TxContext) {
    agent.character.bio = bio.to_string();
}

public fun update_character_lore(agent: &mut Agent, lore: vector<u8>, _ctx: &mut TxContext) {
    agent.character.lore = lore.to_string();
}

public fun update_character_messageExamples(
    agent: &mut Agent,
    messageExamples: vector<u8>,
    _ctx: &mut TxContext,
) {
    agent.character.messageExamples = messageExamples.to_string();
}

public fun update_character_postExamples(
    agent: &mut Agent,
    postExamples: vector<u8>,
    _ctx: &mut TxContext,
) {
    agent.character.postExamples = postExamples.to_string();
}

public fun update_character_topics(agent: &mut Agent, topics: vector<u8>, _ctx: &mut TxContext) {
    agent.character.topics = topics.to_string();
}

public fun update_character_style(agent: &mut Agent, style: vector<u8>, _ctx: &mut TxContext) {
    agent.character.style = style.to_string();
}

public fun update_character_adjectives(
    agent: &mut Agent,
    adjectives: vector<u8>,
    _ctx: &mut TxContext,
) {
    agent.character.adjectives = adjectives.to_string();
}

public fun update_image_url(agent: &mut Agent, image_url: vector<u8>, _ctx: &mut TxContext) {
    agent.image_url = url::new_unsafe_from_bytes(image_url);
}

public fun add_response_blob(agent: &mut Agent, blob: vector<u8>, _ctx: &mut TxContext) {
    agent.response_blobs.push_back(blob.to_string());
}

public fun add_action_blob(agent: &mut Agent, blob: vector<u8>, _ctx: &mut TxContext) {
    agent.action_blobs.push_back(blob.to_string());
}

// ========================= PRIVATE FUNCTIONS =========================

fun assert_admin(cap: &Publisher) {
    assert!(cap.from_module<AGENT>(), ENotAuthorized);
}
