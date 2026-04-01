import 'bootstrap/dist/css/bootstrap.min.css';
import React, { useEffect, useState } from 'react';
import Table from 'react-bootstrap/Table';
import './App.css';

function App() {
    const [activeSpreads, setActiveSpreads] = useState([]);
    const [mexcSpreads, setMexcSpreads] = useState([]);
    const [clickedPairs, setClickedPairs] = useState([]);

    useEffect(() => {
        console.log('🚀 useEffect стартує...');

        const fetchData = () => {
            fetch('http://localhost:3001/spreads')
                .then(res => res.json())
                .then(data => {
                    console.log('✅ Отримано з сервера для Gate:', data);
                    setActiveSpreads(data.spreads);
                })
                .catch(err => console.error('❌ Помилка отримання для Gate:', err));

            fetch('http://localhost:3001/mexc-spreads')
                .then(res => res.json())
                .then(data => {
                    console.log('✅ Отримано з сервера для MEXC:', data);
                    setMexcSpreads(data.spreads);
                })
                .catch(err => console.error('❌ Помилка отримання для MEXC:', err));
        };

        fetchData();
        const interval = setInterval(fetchData, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleLinkClick = (pair) => {
        if (!clickedPairs.includes(pair)) {
            setClickedPairs(prev => [...prev, pair]);
        }
    };

    const formatMexcSymbol = (pair) => {
        if (pair.endsWith("USDT") && !pair.includes("_USDT")) {
            return pair.replace(/USDT$/, '_USDT');
        }
        return pair;
    };

    const getExchangeUrl = (exchange, pair) => {
        if (exchange === 'gate') {
            return `https://www.gate.io/trade/${pair}`;
        } else if (exchange === 'mexc') {
            const formattedPair = formatMexcSymbol(pair);
            return `https://www.mexc.com/ru-RU/exchange/${formattedPair}`;
        }
        return '#';
    };

    const renderTable = (title, data, exchange) => (
        <div className="mb-4">
            <h5 className="mb-3" style={{ color: '#fff' }}>{title}</h5>
            <Table striped bordered hover size="sm" responsive variant="dark">
                <thead>
                <tr>
                    <th>#</th>
                    <th>Монета</th>
                    <th>Спред (%)</th>
                    <th>Ціна</th>
                    <th>Обʼєм</th>
                </tr>
                </thead>
                <tbody>
                {data.length > 0 ? (
                    data.map((item, index) => (
                        <tr key={item.pair + index}>
                            <td>{index + 1}</td>
                            <td>
                                <a
                                    href={getExchangeUrl(exchange, item.pair)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => handleLinkClick(item.pair)}
                                    style={{
                                        textDecoration: 'none',
                                        color: clickedPairs.includes(item.pair) ? 'red' : '#0d6efd',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {item.pair}
                                </a>
                            </td>
                            <td>{item.spread}</td>
                            <td>{item.price}</td>
                            <td>{item.volume}</td>
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan="5" style={{ color: '#ccc' }}>Немає спредів 🤷‍♂️</td>
                    </tr>
                )}
                </tbody>
            </Table>
        </div>
    );

    return (
        <div className="container-fluid" style={{ backgroundColor: '#1e1e1e', minHeight: '100vh', paddingTop: '20px' }}>
            <div className="row">
                <div className="col-md-6">
                    {renderTable('🟢 Gate.io — великі спреди > 1%', activeSpreads, 'gate')}
                </div>
                <div className="col-md-6">
                    {renderTable('🔵 MEXC — великі спреди > 1%', mexcSpreads, 'mexc')}
                </div>
            </div>
        </div>
    );
}

export default App;
