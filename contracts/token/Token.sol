/*
Implements EIP20 token standard: https://github.com/ethereum/EIPs/issues/20
.*/


pragma solidity ^0.4.18;


contract Token {

    address public owner;

    uint256 totalSupply;

    /*
    NOTE:
    The following variables are OPTIONAL vanities. One does not have to include them.
    They allow one to customise the token contract & in no way influences the core functionality.
    Some wallets/interfaces might not even bother to look at this information.
    */
    string public name;                   //fancy name: eg Simon Bucks
    uint8 public decimals;                //How many decimals to show.
    string public symbol;                 //An identifier: eg SBX

    function Token(
        uint256 _initialAmount,
        string _tokenName,
        uint8 _decimalUnits,
        string _tokenSymbol
    ) public {
        totalSupply = _initialAmount;
        name = _tokenName;                                   // Set the name for display purposes
        decimals = _decimalUnits;                            // Amount of decimals for display purposes
        symbol = _tokenSymbol;                               // Set the symbol for display purposes

        owner = msg.sender;
    }

    modifier onlyContractOwner() {
        require(msg.sender == owner);
        _;
    }

    function getTotalSupply() public view returns (uint256 _totalSupply) {
        _totalSupply = totalSupply;
        return _totalSupply;
    }
}
