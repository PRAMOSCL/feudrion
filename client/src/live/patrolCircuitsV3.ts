import type { PatrolCircuit } from './patrolCircuit';

// Datos nativos 1536×1024. Integrar junto a patrolCircuit.ts.
export const PATROL_CIRCUITS_V3: Record<1 | 2 | 3, PatrolCircuit> = {
  "1": {
    "stage": 1,
    "segments": [
      {
        "id": "north-a",
        "side": "north",
        "kind": "wall_walk",
        "feet": [
          [
            368,
            99
          ],
          [
            450,
            99
          ],
          [
            534,
            99
          ]
        ],
        "visibility": "visible",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "tower-near-nw"
        ]
      },
      {
        "id": "tower-near-nw",
        "side": "north",
        "kind": "tower_pass",
        "feet": [
          [
            534,
            99
          ],
          [
            560,
            103
          ],
          [
            590,
            107
          ]
        ],
        "visibility": "hidden",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "north-b"
        ]
      },
      {
        "id": "north-b",
        "side": "north",
        "kind": "wall_walk",
        "feet": [
          [
            590,
            107
          ],
          [
            800,
            165
          ],
          [
            1050,
            233
          ],
          [
            1295,
            301
          ]
        ],
        "visibility": "visible",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "tower-ne"
        ]
      },
      {
        "id": "tower-ne",
        "side": "east",
        "kind": "tower_pass",
        "feet": [
          [
            1295,
            301
          ],
          [
            1320,
            312
          ],
          [
            1360,
            337
          ]
        ],
        "visibility": "hidden",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "east-a"
        ]
      },
      {
        "id": "east-a",
        "side": "east",
        "kind": "wall_walk",
        "feet": [
          [
            1360,
            337
          ],
          [
            1410,
            363
          ],
          [
            1455,
            386
          ]
        ],
        "visibility": "visible",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "tower-east"
        ]
      },
      {
        "id": "tower-east",
        "side": "east",
        "kind": "tower_pass",
        "feet": [
          [
            1455,
            386
          ],
          [
            1495,
            405
          ],
          [
            1508,
            451
          ]
        ],
        "visibility": "hidden",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "east-b"
        ]
      },
      {
        "id": "east-b",
        "side": "east",
        "kind": "wall_walk",
        "feet": [
          [
            1508,
            451
          ],
          [
            1507,
            509
          ],
          [
            1485,
            559
          ],
          [
            1457,
            588
          ],
          [
            1410,
            620
          ]
        ],
        "visibility": "visible",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "tower-gate-east"
        ]
      },
      {
        "id": "tower-gate-east",
        "side": "east",
        "kind": "tower_pass",
        "feet": [
          [
            1410,
            620
          ],
          [
            1370,
            638
          ],
          [
            1325,
            661
          ]
        ],
        "visibility": "hidden",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "gate-platform"
        ]
      },
      {
        "id": "gate-platform",
        "side": "south",
        "kind": "gate_platform",
        "feet": [
          [
            1325,
            661
          ],
          [
            1280,
            679
          ],
          [
            1231,
            697
          ]
        ],
        "visibility": "visible",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "tower-gate-west"
        ]
      },
      {
        "id": "tower-gate-west",
        "side": "south",
        "kind": "tower_pass",
        "feet": [
          [
            1231,
            697
          ],
          [
            1198,
            721
          ],
          [
            1158,
            749
          ]
        ],
        "visibility": "hidden",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "south-a"
        ]
      },
      {
        "id": "south-a",
        "side": "south",
        "kind": "wall_walk",
        "feet": [
          [
            1158,
            749
          ],
          [
            1050,
            782
          ],
          [
            960,
            800
          ],
          [
            867,
            809
          ],
          [
            800,
            807
          ],
          [
            727,
            793
          ],
          [
            543,
            744
          ]
        ],
        "visibility": "visible",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "tower-southwest"
        ]
      },
      {
        "id": "tower-southwest",
        "side": "south",
        "kind": "tower_pass",
        "feet": [
          [
            543,
            744
          ],
          [
            514,
            720
          ],
          [
            451,
            704
          ]
        ],
        "visibility": "hidden",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "south-b"
        ]
      },
      {
        "id": "south-b",
        "side": "south",
        "kind": "wall_walk",
        "feet": [
          [
            451,
            704
          ],
          [
            320,
            662
          ],
          [
            205,
            611
          ]
        ],
        "visibility": "visible",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "west-a"
        ]
      },
      {
        "id": "west-a",
        "side": "west",
        "kind": "wall_walk",
        "feet": [
          [
            205,
            611
          ],
          [
            163,
            582
          ],
          [
            142,
            548
          ],
          [
            114,
            481
          ],
          [
            75,
            390
          ],
          [
            40,
            324
          ]
        ],
        "visibility": "visible",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "tower-west"
        ]
      },
      {
        "id": "tower-west",
        "side": "west",
        "kind": "tower_pass",
        "feet": [
          [
            40,
            324
          ],
          [
            38,
            296
          ],
          [
            76,
            255
          ]
        ],
        "visibility": "hidden",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "west-b"
        ]
      },
      {
        "id": "west-b",
        "side": "west",
        "kind": "wall_walk",
        "feet": [
          [
            76,
            255
          ],
          [
            105,
            234
          ],
          [
            125,
            221
          ]
        ],
        "visibility": "visible",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "tower-nw"
        ]
      },
      {
        "id": "tower-nw",
        "side": "west",
        "kind": "tower_pass",
        "feet": [
          [
            125,
            221
          ],
          [
            162,
            196
          ],
          [
            203,
            173
          ]
        ],
        "visibility": "hidden",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "northwest"
        ]
      },
      {
        "id": "northwest",
        "side": "north",
        "kind": "wall_walk",
        "feet": [
          [
            203,
            173
          ],
          [
            250,
            149
          ],
          [
            287,
            127
          ]
        ],
        "visibility": "visible",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "tower-north"
        ]
      },
      {
        "id": "tower-north",
        "side": "north",
        "kind": "tower_pass",
        "feet": [
          [
            287,
            127
          ],
          [
            329,
            111
          ],
          [
            368,
            99
          ]
        ],
        "visibility": "hidden",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "north-a"
        ]
      }
    ]
  },
  "2": {
    "stage": 2,
    "segments": [
      {
        "id": "north-a",
        "side": "north",
        "kind": "wall_walk",
        "feet": [
          [
            368,
            99
          ],
          [
            450,
            99
          ],
          [
            534,
            99
          ]
        ],
        "visibility": "visible",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "tower-near-nw"
        ]
      },
      {
        "id": "tower-near-nw",
        "side": "north",
        "kind": "tower_pass",
        "feet": [
          [
            534,
            99
          ],
          [
            560,
            103
          ],
          [
            590,
            111
          ]
        ],
        "visibility": "hidden",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "north-b"
        ]
      },
      {
        "id": "north-b",
        "side": "north",
        "kind": "wall_walk",
        "feet": [
          [
            590,
            111
          ],
          [
            800,
            169
          ],
          [
            1050,
            237
          ],
          [
            1295,
            305
          ]
        ],
        "visibility": "visible",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "tower-ne"
        ]
      },
      {
        "id": "tower-ne",
        "side": "east",
        "kind": "tower_pass",
        "feet": [
          [
            1295,
            305
          ],
          [
            1320,
            312
          ],
          [
            1360,
            337
          ]
        ],
        "visibility": "hidden",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "east-a"
        ]
      },
      {
        "id": "east-a",
        "side": "east",
        "kind": "wall_walk",
        "feet": [
          [
            1360,
            337
          ],
          [
            1410,
            363
          ],
          [
            1455,
            386
          ]
        ],
        "visibility": "visible",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "tower-east"
        ]
      },
      {
        "id": "tower-east",
        "side": "east",
        "kind": "tower_pass",
        "feet": [
          [
            1455,
            386
          ],
          [
            1495,
            405
          ],
          [
            1508,
            451
          ]
        ],
        "visibility": "hidden",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "east-b"
        ]
      },
      {
        "id": "east-b",
        "side": "east",
        "kind": "wall_walk",
        "feet": [
          [
            1508,
            451
          ],
          [
            1507,
            509
          ],
          [
            1485,
            559
          ],
          [
            1457,
            588
          ],
          [
            1410,
            620
          ]
        ],
        "visibility": "visible",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "tower-gate-east"
        ]
      },
      {
        "id": "tower-gate-east",
        "side": "east",
        "kind": "tower_pass",
        "feet": [
          [
            1410,
            620
          ],
          [
            1370,
            638
          ],
          [
            1325,
            661
          ]
        ],
        "visibility": "hidden",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "gate-platform"
        ]
      },
      {
        "id": "gate-platform",
        "side": "south",
        "kind": "gate_platform",
        "feet": [
          [
            1325,
            661
          ],
          [
            1280,
            679
          ],
          [
            1231,
            697
          ]
        ],
        "visibility": "visible",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "tower-gate-west"
        ]
      },
      {
        "id": "tower-gate-west",
        "side": "south",
        "kind": "tower_pass",
        "feet": [
          [
            1231,
            697
          ],
          [
            1198,
            721
          ],
          [
            1158,
            749
          ]
        ],
        "visibility": "hidden",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "south-a"
        ]
      },
      {
        "id": "south-a",
        "side": "south",
        "kind": "wall_walk",
        "feet": [
          [
            1158,
            749
          ],
          [
            1050,
            782
          ],
          [
            960,
            800
          ],
          [
            867,
            807
          ],
          [
            800,
            805
          ],
          [
            727,
            791
          ],
          [
            543,
            740
          ]
        ],
        "visibility": "visible",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "tower-southwest"
        ]
      },
      {
        "id": "tower-southwest",
        "side": "south",
        "kind": "tower_pass",
        "feet": [
          [
            543,
            740
          ],
          [
            514,
            720
          ],
          [
            451,
            704
          ]
        ],
        "visibility": "hidden",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "south-b"
        ]
      },
      {
        "id": "south-b",
        "side": "south",
        "kind": "wall_walk",
        "feet": [
          [
            451,
            704
          ],
          [
            320,
            662
          ],
          [
            205,
            611
          ]
        ],
        "visibility": "visible",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "west-a"
        ]
      },
      {
        "id": "west-a",
        "side": "west",
        "kind": "wall_walk",
        "feet": [
          [
            205,
            611
          ],
          [
            163,
            582
          ],
          [
            142,
            548
          ],
          [
            114,
            481
          ],
          [
            75,
            390
          ],
          [
            40,
            324
          ]
        ],
        "visibility": "visible",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "tower-west"
        ]
      },
      {
        "id": "tower-west",
        "side": "west",
        "kind": "tower_pass",
        "feet": [
          [
            40,
            324
          ],
          [
            38,
            296
          ],
          [
            76,
            255
          ]
        ],
        "visibility": "hidden",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "west-b"
        ]
      },
      {
        "id": "west-b",
        "side": "west",
        "kind": "wall_walk",
        "feet": [
          [
            76,
            255
          ],
          [
            105,
            234
          ],
          [
            125,
            221
          ]
        ],
        "visibility": "visible",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "tower-nw"
        ]
      },
      {
        "id": "tower-nw",
        "side": "west",
        "kind": "tower_pass",
        "feet": [
          [
            125,
            221
          ],
          [
            162,
            196
          ],
          [
            203,
            173
          ]
        ],
        "visibility": "hidden",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "northwest"
        ]
      },
      {
        "id": "northwest",
        "side": "north",
        "kind": "wall_walk",
        "feet": [
          [
            203,
            173
          ],
          [
            250,
            149
          ],
          [
            287,
            127
          ]
        ],
        "visibility": "visible",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "tower-north"
        ]
      },
      {
        "id": "tower-north",
        "side": "north",
        "kind": "tower_pass",
        "feet": [
          [
            287,
            127
          ],
          [
            329,
            111
          ],
          [
            368,
            99
          ]
        ],
        "visibility": "hidden",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "north-a"
        ]
      }
    ]
  },
  "3": {
    "stage": 3,
    "segments": [
      {
        "id": "north-a",
        "side": "north",
        "kind": "wall_walk",
        "feet": [
          [
            368,
            99
          ],
          [
            450,
            99
          ],
          [
            534,
            99
          ]
        ],
        "visibility": "visible",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "tower-near-nw"
        ]
      },
      {
        "id": "tower-near-nw",
        "side": "north",
        "kind": "tower_pass",
        "feet": [
          [
            534,
            99
          ],
          [
            560,
            103
          ],
          [
            590,
            111
          ]
        ],
        "visibility": "hidden",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "north-b"
        ]
      },
      {
        "id": "north-b",
        "side": "north",
        "kind": "wall_walk",
        "feet": [
          [
            590,
            111
          ],
          [
            800,
            169
          ],
          [
            1050,
            237
          ],
          [
            1295,
            305
          ]
        ],
        "visibility": "visible",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "tower-ne"
        ]
      },
      {
        "id": "tower-ne",
        "side": "east",
        "kind": "tower_pass",
        "feet": [
          [
            1295,
            305
          ],
          [
            1320,
            312
          ],
          [
            1360,
            337
          ]
        ],
        "visibility": "hidden",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "east-a"
        ]
      },
      {
        "id": "east-a",
        "side": "east",
        "kind": "wall_walk",
        "feet": [
          [
            1360,
            337
          ],
          [
            1410,
            363
          ],
          [
            1455,
            386
          ]
        ],
        "visibility": "visible",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "tower-east"
        ]
      },
      {
        "id": "tower-east",
        "side": "east",
        "kind": "tower_pass",
        "feet": [
          [
            1455,
            386
          ],
          [
            1495,
            405
          ],
          [
            1508,
            451
          ]
        ],
        "visibility": "hidden",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "east-b"
        ]
      },
      {
        "id": "east-b",
        "side": "east",
        "kind": "wall_walk",
        "feet": [
          [
            1508,
            451
          ],
          [
            1507,
            509
          ],
          [
            1485,
            559
          ],
          [
            1457,
            588
          ],
          [
            1410,
            620
          ]
        ],
        "visibility": "visible",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "tower-gate-east"
        ]
      },
      {
        "id": "tower-gate-east",
        "side": "east",
        "kind": "tower_pass",
        "feet": [
          [
            1410,
            620
          ],
          [
            1370,
            638
          ],
          [
            1325,
            661
          ]
        ],
        "visibility": "hidden",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "gate-platform"
        ]
      },
      {
        "id": "gate-platform",
        "side": "south",
        "kind": "gate_platform",
        "feet": [
          [
            1325,
            661
          ],
          [
            1280,
            679
          ],
          [
            1231,
            697
          ]
        ],
        "visibility": "visible",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "tower-gate-west"
        ]
      },
      {
        "id": "tower-gate-west",
        "side": "south",
        "kind": "tower_pass",
        "feet": [
          [
            1231,
            697
          ],
          [
            1198,
            721
          ],
          [
            1158,
            749
          ]
        ],
        "visibility": "hidden",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "south-a"
        ]
      },
      {
        "id": "south-a",
        "side": "south",
        "kind": "wall_walk",
        "feet": [
          [
            1158,
            749
          ],
          [
            1050,
            782
          ],
          [
            960,
            800
          ],
          [
            867,
            807
          ],
          [
            800,
            805
          ],
          [
            727,
            791
          ],
          [
            543,
            740
          ]
        ],
        "visibility": "visible",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "tower-southwest"
        ]
      },
      {
        "id": "tower-southwest",
        "side": "south",
        "kind": "tower_pass",
        "feet": [
          [
            543,
            740
          ],
          [
            514,
            720
          ],
          [
            451,
            704
          ]
        ],
        "visibility": "hidden",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "south-b"
        ]
      },
      {
        "id": "south-b",
        "side": "south",
        "kind": "wall_walk",
        "feet": [
          [
            451,
            704
          ],
          [
            320,
            662
          ],
          [
            205,
            611
          ]
        ],
        "visibility": "visible",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "west-a"
        ]
      },
      {
        "id": "west-a",
        "side": "west",
        "kind": "wall_walk",
        "feet": [
          [
            205,
            611
          ],
          [
            163,
            582
          ],
          [
            142,
            548
          ],
          [
            114,
            481
          ],
          [
            75,
            390
          ],
          [
            40,
            324
          ]
        ],
        "visibility": "visible",
        "layer": "front",
        "spriteHeight": 30,
        "next": [
          "tower-west"
        ]
      },
      {
        "id": "tower-west",
        "side": "west",
        "kind": "tower_pass",
        "feet": [
          [
            40,
            324
          ],
          [
            38,
            296
          ],
          [
            76,
            255
          ]
        ],
        "visibility": "hidden",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "west-b"
        ]
      },
      {
        "id": "west-b",
        "side": "west",
        "kind": "wall_walk",
        "feet": [
          [
            76,
            255
          ],
          [
            105,
            234
          ],
          [
            125,
            221
          ]
        ],
        "visibility": "visible",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "tower-nw"
        ]
      },
      {
        "id": "tower-nw",
        "side": "west",
        "kind": "tower_pass",
        "feet": [
          [
            125,
            221
          ],
          [
            162,
            196
          ],
          [
            203,
            173
          ]
        ],
        "visibility": "hidden",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "northwest"
        ]
      },
      {
        "id": "northwest",
        "side": "north",
        "kind": "wall_walk",
        "feet": [
          [
            203,
            173
          ],
          [
            250,
            149
          ],
          [
            287,
            127
          ]
        ],
        "visibility": "visible",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "tower-north"
        ]
      },
      {
        "id": "tower-north",
        "side": "north",
        "kind": "tower_pass",
        "feet": [
          [
            287,
            127
          ],
          [
            329,
            111
          ],
          [
            368,
            99
          ]
        ],
        "visibility": "hidden",
        "layer": "back",
        "spriteHeight": 30,
        "next": [
          "north-a"
        ]
      }
    ]
  }
};
