import { GameUpdateType } from "src/core/game/GameUpdates";
import { NukeExecution } from "../src/core/execution/NukeExecution";
import { PlayerExecution } from "../src/core/execution/PlayerExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { setup } from "./util/Setup";
import { TestConfig } from "./util/TestConfig";

let game: Game;
let player1: Player;
let player2: Player;
let player3: Player;

describe("Alliance acceptance destroys nukes", () => {
  beforeEach(async () => {
    game = await setup(
      "plains",
      {
        infiniteGold: true,
        instantBuild: true,
        infiniteTroops: true,
      },
      [
        new PlayerInfo("player1", PlayerType.Human, "c1", "p1"),
        new PlayerInfo("player2", PlayerType.Human, "c2", "p2"),
        new PlayerInfo("player3", PlayerType.Human, "c3", "p3"),
      ],
    );

    (game.config() as TestConfig).nukeAllianceBreakThreshold = () => 0;

    while (game.inSpawnPhase()) {
      game.executeNextTick();
    }

    player1 = game.player("p1");
    player2 = game.player("p2");
    player3 = game.player("p3");

    player1.conquer(game.ref(0, 0));
    player2.conquer(game.ref(5, 5));
    player3.conquer(game.ref(10, 10));

    player1.buildUnit(UnitType.MissileSilo, game.ref(0, 0), {});
  });

  test("accepting alliance destroys in-flight nukes between players", () => {
    game.addExecution(
      new NukeExecution(
        UnitType.AtomBomb,
        player1,
        game.ref(5, 5),
        game.ref(0, 0),
        -1,
        5,
      ),
    );

    game.executeNextTick(); // init
    game.executeNextTick(); // spawn nuke

    const nukesBefore = game.units(UnitType.AtomBomb).length;
    expect(nukesBefore).toBe(1);

    expect(player2.isAlliedWith(player1)).toBe(false);
    expect(player1.isFriendly(player2)).toBe(false);

    const req = player2.createAllianceRequest(player1);
    req!.accept();

    expect(player2.isAlliedWith(player1)).toBe(true);
    expect(player1.isFriendly(player2)).toBe(true);

    // Run PlayerExecution.tick() for the target player, so it doesn't depend on tick ordering.
    const pe = new PlayerExecution(player2);
    pe.init(game, game.ticks());
    pe.tick(game.ticks());

    expect(game.units(UnitType.AtomBomb)).toHaveLength(0);
    game.executeNextTick();
    expect(game.units(UnitType.AtomBomb)).toHaveLength(0);
  });

  test("accepting alliance does not destroy nukes targeting third players", () => {
    game.addExecution(
      new NukeExecution(UnitType.AtomBomb, player1, game.ref(10, 10), null),
    );

    game.executeNextTick(); // init
    game.executeNextTick(); // spawn

    expect(player2.isAlliedWith(player1)).toBe(false);
    expect(player1.isFriendly(player2)).toBe(false);

    const req = player1.createAllianceRequest(player2);
    req!.accept();

    expect(player2.isAlliedWith(player1)).toBe(true);
    expect(player1.isFriendly(player2)).toBe(true);

    game.executeNextTick();

    expect(game.units(UnitType.AtomBomb)).toHaveLength(1);
  });

  test("accepting alliance displays correct nuke cancellation messages", () => {
    game.addExecution(
      new NukeExecution(
        UnitType.AtomBomb,
        player1,
        game.ref(5, 5),
        game.ref(0, 0),
        -1,
        5,
      ),
    );

    game.executeNextTick(); // init
    game.executeNextTick(); // spawn nuke

    const nukesBefore = game.units(UnitType.AtomBomb).length;
    expect(nukesBefore).toBe(1);

    expect(player2.isAlliedWith(player1)).toBe(false);
    expect(player1.isFriendly(player2)).toBe(false);

    const req = player2.createAllianceRequest(player1);
    req!.accept();

    expect(player2.isAlliedWith(player1)).toBe(true);
    expect(player1.isFriendly(player2)).toBe(true);

    // Run PlayerExecution.tick() for the target player, so it doesn't depend on tick ordering.
    const pe = new PlayerExecution(player2);
    pe.init(game, game.ticks());
    pe.tick(game.ticks());

    expect(game.units(UnitType.AtomBomb)).toHaveLength(0);
    const updates = game.executeNextTick();
    expect(game.units(UnitType.AtomBomb)).toHaveLength(0);

    const messages =
      updates[GameUpdateType.DisplayEvent]?.map((e) => e.message) ?? [];

    expect(
      messages.some((m) => m.includes("destroyed due to the alliance")),
    ).toBe(true);
  });
});
