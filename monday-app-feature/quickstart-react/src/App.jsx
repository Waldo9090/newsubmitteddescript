import React from "react";
import { useState, useEffect } from "react";
import "./App.css";
import mondaySdk from "monday-sdk-js";
import "@vibe/core/tokens";
//Explore more Monday React Components here: https://vibe.monday.com/
import { AttentionBox, Button, Dropdown, TextField } from "@vibe/core";

// Usage of mondaySDK example, for more information visit here: https://developer.monday.com/apps/docs/introduction-to-the-sdk/
const monday = mondaySdk();

const App = () => {
  const [context, setContext] = useState();
  const [boards, setBoards] = useState([]);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [itemName, setItemName] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Notice this method notifies the monday platform that user gains a first value in an app.
    // Read more about it here: https://developer.monday.com/apps/docs/mondayexecute#value-created-for-user/
    monday.execute("valueCreatedForUser");

    // TODO: set up event listeners, Here`s an example, read more here: https://developer.monday.com/apps/docs/mondaylisten/
    monday.listen("context", (res) => {
      setContext(res.data);
    });

    // Fetch boards when component mounts
    fetchBoards();
  }, []);

  const fetchBoards = async () => {
    try {
      const query = `query { boards(limit: 20) { id name } }`;
      const response = await monday.api(query);
      
      if (response.data && response.data.boards) {
        setBoards(response.data.boards);
      }
    } catch (error) {
      setErrorMessage("Failed to fetch boards. Please try again.");
      console.error("Error fetching boards:", error);
    }
  };

  const fetchGroups = async (boardId) => {
    try {
      const query = `query { boards(ids: ${boardId}) { groups { id title } } }`;
      const response = await monday.api(query);
      
      if (response.data && response.data.boards && response.data.boards[0].groups) {
        setGroups(response.data.boards[0].groups);
      }
    } catch (error) {
      setErrorMessage("Failed to fetch groups. Please try again.");
      console.error("Error fetching groups:", error);
    }
  };

  const handleBoardSelect = (option) => {
    setSelectedBoard(option);
    setSelectedGroup(null);
    setGroups([]);
    fetchGroups(option.value);
  };

  const handleGroupSelect = (option) => {
    setSelectedGroup(option);
  };

  const createItem = async () => {
    if (!selectedBoard || !selectedGroup || !itemName.trim()) {
      setErrorMessage("Please fill in all fields");
      return;
    }

    try {
      const query = `mutation {
        create_item (
          board_id: ${selectedBoard.value}, 
          group_id: "${selectedGroup.value}", 
          item_name: "${itemName}"
        ) {
          id
        }
      }`;

      const response = await monday.api(query);
      
      if (response.data && response.data.create_item && response.data.create_item.id) {
        setSuccessMessage(`Item "${itemName}" created successfully!`);
        setItemName("");
        setErrorMessage("");
        
        // Reset success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage("");
        }, 3000);
      }
    } catch (error) {
      setErrorMessage("Failed to create item. Please try again.");
      console.error("Error creating item:", error);
    }
  };

  return (
    <div className="App">
      <h1>Create Monday.com Item</h1>
      
      {successMessage && (
        <AttentionBox
          title="Success!"
          text={successMessage}
          type="success"
          className="message-box"
        />
      )}
      
      {errorMessage && (
        <AttentionBox
          title="Error"
          text={errorMessage}
          type="danger"
          className="message-box"
        />
      )}
      
      <div className="form-container">
        <div className="form-field">
          <label>Select Board</label>
          <Dropdown
            placeholder="Choose a board"
            options={boards.map(board => ({ label: board.name, value: board.id }))}
            onChange={handleBoardSelect}
            value={selectedBoard}
          />
        </div>
        
        {selectedBoard && (
          <div className="form-field">
            <label>Select Group</label>
            <Dropdown
              placeholder="Choose a group"
              options={groups.map(group => ({ label: group.title, value: group.id }))}
              onChange={handleGroupSelect}
              value={selectedGroup}
            />
          </div>
        )}
        
        <div className="form-field">
          <label>Item Name</label>
          <TextField
            placeholder="Enter item name"
            value={itemName}
            onChange={(value) => setItemName(value)}
          />
        </div>
        
        <Button onClick={createItem} disabled={!selectedBoard || !selectedGroup || !itemName.trim()}>
          Create Item
        </Button>
      </div>
    </div>
  );
};

export default App;
