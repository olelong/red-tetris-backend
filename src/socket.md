# Socket events

## Error Handling

Each error, no matter from what event, is sent through the "error" event and respect this structure:
```js
{
    errorMsg: String | String[],
    origin: {
        event: String,
        data: Object
    }
}
```

## Game

### Send to Server

Create game / room
```js
/* EVENT */
"room:create"
{
    room: String | undefined, // undefined for solo
    username: String | undefined // undefined for solo
}
/* ACK */
true or false
```

Join room
```js
/* EVENT */
"room:join"
{
    room: String,
    username: String
}
/* ACK */
{
    joined: Boolean,
    reason: "Room Not Found" | "Already in a Room" | "Username Taken" | "In Game" | "Room Full" | undefined // undefined if joined is true
}
```

Launch the game (only by the room's master)
```js
/* EVENT */
"game:launch"
/* ACK */
true or false
```

Move current piece
```js
/* EVENT */
"game:move"
{
    move: "left" | "right" | "rotation" | "soft drop" | "hard drop"
}
/* ACK */
true or false
```

### Receive from Server

Get who is the master (sent when player joins, when it changes and when game ends)
```js
/* EVENT */
"room:master"
{
    username: String
}
```

Players list (sent when player joins, when it changes and when game ends)
```js
/* EVENT */
"room:players"
{
    players: String[]
}
```

Game update
```js
/* EVENT */
"game:update"
{
    board: Number[],
    gameOver: true // when the game is over for the player
}
```
> `board` is an array of 200 numbers between 0 and 8 (0 = empty, 1-7 = all pieces colors, 8 = penalty). It starts at the top left and ends at the bottom right.

Spectrums update
```js
/* EVENT */
"game:spectrums"
{
    spectrums: [
      { username: String, spectrum: Number[] },
      { username: String, spectrum: Number[] }
    ]
}
```
> Each `spectrum` is an array of ten numbers representing the height of each line of the opponent's board.

Game end
```js
/* EVENT */
"game:end"
{
    winner: String | undefined // undefined if solo
}
```
